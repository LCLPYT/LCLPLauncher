import { ipcRenderer } from "electron";
import { IpcRendererEvent } from "electron/renderer";
import App from "../../common/types/App";
import AppDependency from "../../common/types/AppDependency";
import AppState from "../../common/types/AppState";
import InstallationInputResult, { InputMap } from "../../common/types/InstallationInputResult";
import UpdateCheckResult from "../../common/types/UpdateCheckResult";
import { ACTIONS, GenericIPCActionHandler, GenericIPCHandler } from "../../common/utils/ipc";
import { updateInstallationProgress, updateInstallationState, updatePackageDownloadProgress } from "./downloads";
import { addToast, removeToast } from "./toasts";
import { postUpdateError, postUpdateProgress, postUpdateState } from "./updater";
import { setWindowMaximizable } from "./windowEvents";

abstract class IPCActionHandler extends GenericIPCActionHandler<IpcRendererEvent, IpcRendererEvent> {
    protected getIpcEvent(event: IpcRendererEvent): IpcRendererEvent {
        return event;
    }

    public sendRawMessage(...args: any[]) {
        ipcRenderer.send(this.channel, args);
    }

    public sendAction(action: string, ...args: any[]) {
        this.sendRawMessage(action, ...args);
    }
}

const IPC_HANDLERS: GenericIPCHandler<IpcRendererEvent>[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcRenderer.on(handler.channel, (event, args) => handler.onMessage(event, args)));
}

function registerHandler<T extends GenericIPCHandler<IpcRendererEvent>>(handler: T) {
    IPC_HANDLERS.push(handler);
    return handler;
}

export const LIBRARY = registerHandler(new class extends IPCActionHandler {
    protected addAppToLibraryCB?: (success: boolean) => void;
    protected isAppInLibraryCB?: (inLibrary: boolean) => void;
    protected getLibraryAppsCB?: (apps: (App[] | null)) => void;
    protected startAppCB?: {
        resolve: () => void,
        reject: (error: any) => void
    };
    protected stopAppCB?: {
        resolve: (stopped: boolean) => void,
        reject: (error: any) => void
    };

    protected onAction(action: string, _event: IpcRendererEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.library.addAppToLibrary:
                if(args.length < 1) throw new Error('Success argument does not exist.');
                if(this.addAppToLibraryCB) {
                    this.addAppToLibraryCB(args[0]);
                    this.addAppToLibraryCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.addAppToLibrary);
                break;
            case ACTIONS.library.isAppInLibrary:
                if(args.length < 1) throw new Error('Result argument does not exist.');
                if(this.isAppInLibraryCB) {
                    this.isAppInLibraryCB(args[0]);
                    this.isAppInLibraryCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.isAppInLibrary);
                break;
            case ACTIONS.library.getLibraryApps:
                if(args.length < 1) throw new Error('Apps argument does not exist.');
                if(this.getLibraryAppsCB) {
                    this.getLibraryAppsCB(args[0]);
                    this.getLibraryAppsCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.getLibraryApps);
                break;
            case ACTIONS.library.startApp:
                if (args.length < 1) throw new Error('Error argument does not exist.');
                if (this.startAppCB) {
                    if (args[0] === null) this.startAppCB.resolve();
                    else this.startAppCB.reject(args[0]);
                    this.startAppCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.startApp);
                break;
            case ACTIONS.library.stopApp:
                if (args.length < 1) throw new Error('Error argument does not exist.');
                if (this.stopAppCB) {
                    if (typeof args[0] === 'boolean') this.stopAppCB.resolve(args[0]);
                    else this.stopAppCB.reject(args[0]);
                    this.stopAppCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.stopApp);
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public addAppToLibrary(app: App): Promise<boolean> {
        if(this.addAppToLibraryCB) return Promise.resolve(false);
        return new Promise(resolve => {
            this.addAppToLibraryCB = success => resolve(success);
            this.sendAction(ACTIONS.library.addAppToLibrary, app);
        });
    }

    public isAppInLibrary(app: App): Promise<boolean | null> {
        if(this.isAppInLibraryCB) return Promise.resolve(null);
        return new Promise(resolve => {
            this.isAppInLibraryCB = inLibrary => resolve(inLibrary);
            this.sendAction(ACTIONS.library.isAppInLibrary, app);
        });
    }

    public getLibraryApps(): Promise<App[]> {
        if(this.isAppInLibraryCB) return Promise.resolve([]);
        return new Promise((resolve, reject) => {
            this.getLibraryAppsCB = apps => {
                if(apps === null) reject(new Error('IPC main returned null as fetch result.'));
                else resolve(apps);
            };
            this.sendAction(ACTIONS.library.getLibraryApps);
        })
    }

    public startApp(app: App): Promise<boolean> {
        if (this.startAppCB) return Promise.resolve(false);
        return new Promise((resolve, reject) => {
            this.startAppCB = {
                resolve: () => resolve(true),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.library.startApp, app);
        });
    }

    public stopApp(app: App): Promise<boolean | null> {
        if (this.stopAppCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.stopAppCB = {
                resolve: stopped => resolve(stopped),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.library.stopApp, app);
        });
    }
}('library'));

export const DOWNLOADER = registerHandler(new class extends IPCActionHandler {
    protected startInstallationProcessCB?: {
        resolve: (finishedWithSuccess: boolean) => void,
        reject: (error: any) => void
    };
    protected getAppStateCB: {
        resolve: (state: AppState) => void,
        reject: (error: any) => void
    }[] = [];
    protected getInstallationDirCB: {
        resolve: (dir: string | undefined) => void,
        reject: (error: any) => void
    }[] = [];
    protected isValidInstallationDirCB?: {
        resolve: () => void,
        reject: (error: any) => void
    };
    protected getDefaultInstallationDirCB?: {
        resolve: (dir: string) => void,
        reject: (error: any) => void
    }
    protected uninstallCB?: {
        resolve: () => void,
        reject: (error: any) => void
    }
    protected getUninstalledDependenciesCB?: {
        resolve: (deps: AppDependency[]) => void,
        reject: (error: any) => void
    };
    protected isLauncherInstallerVersionValidCB?: {
        resolve: (valid: boolean) => void,
        reject: (error: any) => void
    }
    protected getAdditionalInputsCB?: {
        resolve: (result: InstallationInputResult) => void,
        reject: (error: any) => void
    }

    protected onAction(action: string, _event: Electron.IpcRendererEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.downloader.startInstallationProcess:
                if(args.length < 1) throw new Error('Success argument does not exist.');
                if(this.startInstallationProcessCB) {
                    const success = <boolean> args[0];
                    if(success) this.startInstallationProcessCB.resolve(<boolean> args[0]);
                    else this.startInstallationProcessCB.reject(args[1]);
                    this.startInstallationProcessCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.startInstallationProcess);
                break;
            case ACTIONS.downloader.getAppState:
                if (args.length < 1) throw new Error('State result argument does not exist.');
                if (this.getAppStateCB) {
                    const state: AppState | null = args[0];
                    if (state) this.getAppStateCB.forEach(cb => cb.resolve(state));
                    else this.getAppStateCB.forEach(cb => cb.reject(args.length >= 2 ? args[1] : new Error('No error argument provided')));
                    this.getAppStateCB = [];
                } else console.warn('No callback defined for', ACTIONS.downloader.getAppState);
                break;
            case ACTIONS.downloader.getInstallationDir:
                if (args.length < 1) throw new Error('Installation dir argument does not exist.');
                if (this.getInstallationDirCB) {
                    const dir: string | undefined | null = args[0];
                    if (dir) this.getInstallationDirCB.forEach(cb => cb.resolve(dir));
                    else if(args.length >= 2) this.getInstallationDirCB.forEach(cb => cb.reject(args[1]));
                    else this.getInstallationDirCB.forEach(cb => cb.resolve(undefined));
                    this.getInstallationDirCB = [];
                } else console.warn('No callback defined for', ACTIONS.downloader.getInstallationDir);
                break;
            case ACTIONS.downloader.isValidInstallationDir:
                if (args.length < 1) throw new Error('Validity argument does not exist.');
                if (this.isValidInstallationDirCB) {
                    const err = args[0];
                    if (!err) this.isValidInstallationDirCB.resolve()
                    else this.isValidInstallationDirCB.reject(err);
                    this.isValidInstallationDirCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.isValidInstallationDir);
                break;
            case ACTIONS.downloader.getDefaultInstallationDir:
                if (args.length < 1) throw new Error('Default Installation dir argument does not exist.');
                if (this.getDefaultInstallationDirCB) {
                    const dir: string | null = args[0];
                    if (dir) this.getDefaultInstallationDirCB.resolve(dir);
                    else if(args.length >= 2) this.getDefaultInstallationDirCB.reject(args[1]);
                    else this.getDefaultInstallationDirCB.reject(new Error('No further information provided'));
                    this.getDefaultInstallationDirCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.getDefaultInstallationDir);
                break;
            case ACTIONS.downloader.updateInstallationState:
                updateInstallationState(args.length >= 1 ? args[0] : undefined);
                break;
            case ACTIONS.downloader.updateInstallationProgress:
                if (args.length < 1) throw new Error('Progress argument does not exist.');
                updateInstallationProgress(args[0]);
                break;
            case ACTIONS.downloader.updatePackageDownloadProgress:
                if (args.length < 1) throw new Error('Progress argument does not exist.');
                updatePackageDownloadProgress(args[0]);
                break;
            case ACTIONS.downloader.uninstall:
                if (args.length < 1) throw new Error('Error argument does not exist.');
                if (this.uninstallCB) {
                    const err: any = args[0];
                    if (err) this.uninstallCB.reject(err);
                    else this.uninstallCB.resolve();
                    this.uninstallCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.uninstall);
                break;
            case ACTIONS.downloader.getUninstalledDependencies:
                if (args.length < 1) throw new Error('Dependencies argument is missing.');
                if (this.getUninstalledDependenciesCB) {
                    const deps: AppDependency[] | null = args[0];
                    if (deps) this.getUninstalledDependenciesCB.resolve(deps);
                    else if (args.length >= 2) this.getUninstalledDependenciesCB.reject(args[1]);
                    else this.getUninstalledDependenciesCB.reject(new Error('No further information provided'));
                    this.getUninstalledDependenciesCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.getUninstalledDependencies);
                break;
            case ACTIONS.downloader.isLauncherInstallerVersionValid:
                if (args.length < 1) throw new Error('Validity argument is missing.');
                if (this.isLauncherInstallerVersionValidCB) {
                    const valid: boolean | null = args[0];
                    if (valid !== null) this.isLauncherInstallerVersionValidCB.resolve(valid);
                    else if (args.length >= 2) this.isLauncherInstallerVersionValidCB.reject(args[1]);
                    else this.isLauncherInstallerVersionValidCB.reject(new Error('No futher information provided'));
                    this.isLauncherInstallerVersionValidCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.isLauncherInstallerVersionValid);
                break;
            case ACTIONS.downloader.getAdditionalInputs:
                if (args.length < 1) throw new Error('Result argument is missing.');
                if (this.getAdditionalInputsCB) {
                    if (args.length >= 2) this.getAdditionalInputsCB.reject(args[1]);
                    else this.getAdditionalInputsCB.resolve(args[0]);
                    this.getAdditionalInputsCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.getAdditionalInputs);
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public startInstallationProcess(app: App, installationDir: string, map: InputMap): Promise<boolean | null> {
        if(this.startInstallationProcessCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.startInstallationProcessCB = {
                resolve: success => resolve(success),
                reject: error => reject(error)
            };
            this.sendAction(ACTIONS.downloader.startInstallationProcess, app, installationDir, map);
        });
    }

    public getAppStatus(app: App): Promise<AppState> {
        return new Promise((resolve, reject) => {
            this.getAppStateCB.push({
                resolve: state => resolve(state),
                reject: err => reject(err)
            });
            if (this.getAppStateCB.length === 1) this.sendAction(ACTIONS.downloader.getAppState, app);
        });
    }

    public getInstallationDir(app: App): Promise<string | undefined> {
        return new Promise((resolve, reject) => {
            this.getInstallationDirCB.push({
                resolve: dir => resolve(dir),
                reject: err => reject(err)
            });
            if (this.getInstallationDirCB.length === 1) this.sendAction(ACTIONS.downloader.getInstallationDir, app);
        });
    }

    public isValidInstallationDir(dir: string): Promise<void | null> {
        if (this.isValidInstallationDirCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.isValidInstallationDirCB = {
                resolve: () => resolve(),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.isValidInstallationDir, dir);
        });
    }

    public getDefaultInstallationDir(app: App): Promise<string | null> {
        if (this.getDefaultInstallationDirCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.getDefaultInstallationDirCB = {
                resolve: dir => resolve(dir),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.getDefaultInstallationDir, app);
        });
    }

    public uninstall(app: App): Promise<void> {
        if (this.uninstallCB) return Promise.resolve();
        return new Promise((resolve, reject) => {
            this.uninstallCB = {
                resolve: () => resolve(),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.uninstall, app);
        });
    }

    public getUninstalledDependencies(app: App): Promise<AppDependency[] | null> {
        if (this.getUninstalledDependenciesCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.getUninstalledDependenciesCB = {
                resolve: deps => resolve(deps),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.getUninstalledDependencies, app);
        });
    }

    public isLauncherInstallerVersionValid(app: App): Promise<boolean | null> {
        if (this.isLauncherInstallerVersionValidCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.isLauncherInstallerVersionValidCB = {
                resolve: valid => resolve(valid),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.isLauncherInstallerVersionValid, app);
        });
    }

    public getAdditionalInputs(app: App, installationDir: string): Promise<InstallationInputResult | null> {
        if (this.getAdditionalInputsCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.getAdditionalInputsCB = {
                resolve: result => resolve(result),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.getAdditionalInputs, app, installationDir);
        });
    }
}('downloader'));

export const UTILITIES = registerHandler(new class extends IPCActionHandler {
    protected chooseFileCB?: {
        resolve: (dir: Electron.OpenDialogReturnValue | null) => void,
        reject: (error: any) => void
    }

    protected isWindowMaximizedCB: {
        resolve: (maximized: boolean | null) => void,
        reject: (error: any) => void
    }[] = [];

    protected getAppVersionCB: {
        resolve: (version: string) => void,
        reject: (error: any) => void
    }[] = [];

    protected getAppPathCB: {
        resolve: (path: string) => void,
        reject: (error: any) => void
    }[] = [];

    protected doesFileExistCB: Map<string, {
        resolve: (exists: boolean) => void,
        reject: (error: any) => void
    }[]> = new Map();

    protected onAction(action: string, _event: Electron.IpcRendererEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.utilities.chooseFile:
                if (args.length < 1) throw new Error('Chosen files argument does not exist.');
                if (this.chooseFileCB) {
                    const dir: Electron.OpenDialogReturnValue | null = args[0];
                    if (dir) this.chooseFileCB.resolve(dir);
                    else if(args.length >= 2) this.chooseFileCB.reject(args[1]);
                    else this.chooseFileCB.resolve(null)
                    this.chooseFileCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.utilities.chooseFile);
                break;
            case ACTIONS.utilities.setMaximizable:
                if (args.length < 1) throw new Error('Maximizable argument does not exist.');
                setWindowMaximizable(args[0]);
                break;
            case ACTIONS.utilities.isWindowMaximized:
                if (args.length < 1) throw new Error('Maximized argument does not exist.');
                if (this.isWindowMaximizedCB) {
                    const maximized: boolean | null = args[0];
                    this.isWindowMaximizedCB.forEach(cb => cb.resolve(maximized));
                    this.isWindowMaximizedCB = [];
                } else console.warn('No callback defined for', ACTIONS.utilities.isWindowMaximized);
                break;
            case ACTIONS.utilities.getAppVersion:
                if (args.length < 1) throw new Error('Version argument does not exist.');
                if (this.getAppVersionCB) {
                    const version: string = args[0];
                    this.getAppVersionCB.forEach(cb => cb.resolve(version));
                    this.getAppVersionCB = [];
                } else console.warn('No callback defined for', ACTIONS.utilities.getAppVersion);
                break;
            case ACTIONS.utilities.getAppPath:
                if (args.length < 1) throw new Error('Path argument does not exist.');
                if (this.getAppPathCB) {
                    const path: string = args[0];
                    this.getAppPathCB.forEach(cb => cb.resolve(path));
                    this.getAppPathCB = [];
                } else console.warn('No callback defined for', ACTIONS.utilities.getAppPath);
                break;
            case ACTIONS.utilities.doesFileExist:
                if (args.length < 2) throw new Error('File, existence argument does not exist.');
                const callbacks = this.doesFileExistCB.get(args[0]);
                if (!callbacks) throw new Error('Callback storage does not exist.');

                if (args.length >= 3) callbacks.forEach(cb => cb.reject(args[2]));
                else callbacks.forEach(cb => cb.resolve(args[1]));

                this.doesFileExistCB.delete(args[0]);
                break;
            case ACTIONS.utilities.changeLocationHash:
                if (args.length < 1) throw new Error('Hash argument does not exist.');
                window.location.hash = args[0];
                break;
            case ACTIONS.utilities.console_log:
                if (args.length < 1) throw new Error('Message segments do not exist.');
                console.log(...args);
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public chooseFiles(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue | null> {
        if (this.chooseFileCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.chooseFileCB = {
                resolve: dir => resolve(dir),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.utilities.chooseFile, options);
        });
    }

    public exitApp() {
        this.sendAction(ACTIONS.utilities.exitApp);
    }

    public closeWindow() {
        this.sendAction(ACTIONS.utilities.closeWindow);
    }

    public maximizeWindow() {
        this.sendAction(ACTIONS.utilities.maximizeWindow);
    }

    public unmaximizeWindow() {
        this.sendAction(ACTIONS.utilities.unmaximizeWindow);
    }

    public minimizeWindow() {
        this.sendAction(ACTIONS.utilities.minimizeWindow);
    }

    public isWindowMaximized(): Promise<boolean | null> {
        return new Promise((resolve, reject) => {
            this.isWindowMaximizedCB.push({
                resolve: maximized => resolve(maximized),
                reject: err => reject(err)
            });
            if (this.isWindowMaximizedCB.length === 1) this.sendAction(ACTIONS.utilities.isWindowMaximized);
        });
    }

    public getAppVersion(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.getAppVersionCB.push({
                resolve: version => resolve(version),
                reject: err => reject(err)
            });
            if (this.getAppVersionCB.length === 1) this.sendAction(ACTIONS.utilities.getAppVersion);
        });
    }

    public removeAllListeners() {
        this.sendAction(ACTIONS.utilities.removeAllListeners);
    }

    public getAppPath(): Promise<string> {
        return new Promise((resolve, reject) => {
            this.getAppPathCB.push({
                resolve: path => resolve(path),
                reject: err => reject(err)
            });
            if (this.getAppPathCB.length === 1) this.sendAction(ACTIONS.utilities.getAppPath);
        });
    }

    public toggleDevTools() {
        this.sendAction(ACTIONS.utilities.toggleDevTools);
    }

    public toggleFullScreen() {
        this.sendAction(ACTIONS.utilities.toggleFullScreen);
    }

    public doesFileExist(file: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!this.doesFileExistCB.has(file)) this.doesFileExistCB.set(file, []);
            const callbacks = this.doesFileExistCB.get(file);
            if (!callbacks) throw new Error(`Callbacks storage not found for '${file}'`);

            callbacks.push({
                resolve: exists => resolve(exists),
                reject: err => reject(err)
            });

            if (callbacks.length === 1) this.sendAction(ACTIONS.utilities.doesFileExist, file);
        });
    }
    
}('utilities'));

export const TOASTS = registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, _event: Electron.IpcRendererEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.toasts.addToast:
                if (args.length < 1) throw new Error('Toast argument does not exist.');
                addToast(args[0]);
                break;
            case ACTIONS.toasts.removeToast:
                if (args.length < 1) throw new Error('Toast id argument does not exist.');
                removeToast(args[0]);
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }
}('toasts'));

export const UPDATER = registerHandler(new class extends IPCActionHandler {
    protected isUpdateCheckingCB: {
        resolve: (state: boolean, result: UpdateCheckResult | undefined) => void,
        reject: (error: any) => void
    }[] = [];

    protected startUpdateCB?: {
        resolve: () => void,
        reject: (error: any) => void
    };

    protected onAction(action: string, _event: Electron.IpcRendererEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.updater.sendUpdateState:
                if (args.length < 1) throw new Error('Update state argument does not exist.');
                postUpdateState(args[0]);
                break;
            case ACTIONS.updater.isUpdateChecking:
                if (args.length < 3) throw new Error('Update checking arguments do not exist.');
                if (this.isUpdateCheckingCB) {
                    const checking: boolean = args[0];
                    const result: UpdateCheckResult | undefined = args[1];
                    const err = args[2];
                    if (err) this.isUpdateCheckingCB.forEach(cb => cb.reject(err));
                    else this.isUpdateCheckingCB.forEach(cb => cb.resolve(checking, result));
                    this.isUpdateCheckingCB = [];
                } else console.warn('No callback defined for', ACTIONS.updater.isUpdateChecking);
                break;
            case ACTIONS.updater.startUpdate:
                if (args.length < 1) throw new Error('Error argument does not exist.');
                if (this.startUpdateCB) {
                    const err = args[0];
                    if (err === null) this.startUpdateCB.resolve();
                    else this.startUpdateCB.reject(err);
                } else console.warn('No callback defined for', ACTIONS.updater.startUpdate);
                break;
            case ACTIONS.updater.sendError:
                if (args.length < 1) throw new Error('Error argument does not exist.');
                postUpdateError(args[0]);
                break;
            case ACTIONS.updater.sendProgress:
                if (args.length < 1) throw new Error('Progress info argument does not exist.');
                postUpdateProgress(args[0]);
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public isUpdateChecking(): Promise<[boolean, UpdateCheckResult | undefined]> {
        return new Promise((resolve, reject) => {
            this.isUpdateCheckingCB.push({
                resolve: (checking, result) => resolve([checking, result]),
                reject: err => reject(err)
            });
            if (this.isUpdateCheckingCB.length === 1) this.sendAction(ACTIONS.updater.isUpdateChecking);
        });
    }

    public skipUpdate() {
        this.sendAction(ACTIONS.updater.skipUpdate);
    }

    public startUpdate(): Promise<boolean> {
        if (this.startUpdateCB) return Promise.resolve(false);
        return new Promise((resolve, reject) => {
            this.startUpdateCB = {
                resolve: () => resolve(true),
                reject: err => reject(err)
            }
            this.sendAction(ACTIONS.updater.startUpdate);
        });
    }
}('updater'));