import { ipcRenderer } from "electron";
import { IpcRendererEvent } from "electron/renderer";
import App from "../../common/types/App";
import AppState from "../../common/types/AppState";
import { ACTIONS, GenericIPCActionHandler, GenericIPCHandler } from "../../common/utils/ipc";
import { addToast, removeToast } from "./toasts";

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

    protected onAction(action: string, _event: IpcRendererEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.library.addAppToLibrary:
                if(args.length < 1) throw new Error('Success argument does not exist.');
                if(this.addAppToLibraryCB) {
                    this.addAppToLibraryCB(<boolean> args[0]);
                    this.addAppToLibraryCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.addAppToLibrary);
                break;
            case ACTIONS.library.isAppInLibrary:
                if(args.length < 1) throw new Error('Result argument does not exist.');
                if(this.isAppInLibraryCB) {
                    this.isAppInLibraryCB(<boolean> args[0]);
                    this.isAppInLibraryCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.isAppInLibrary);
                break;
            case ACTIONS.library.getLibraryApps:
                if(args.length < 1) throw new Error('Apps argument does not exist.');
                if(this.getLibraryAppsCB) {
                    this.getLibraryAppsCB(<App[]> args[0]);
                    this.getLibraryAppsCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.library.getLibraryApps);
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
}('library'));

export const DOWNLOADER = registerHandler(new class extends IPCActionHandler {
    protected startInstallationProcessCB?: {
        resolve: (finishedWithSuccess: boolean) => void,
        reject: (error: any) => void
    };
    protected getAppStateCB?: {
        resolve: (state: AppState) => void,
        reject: (error: any) => void
    }
    protected getInstallationDirCB?: {
        resolve: (dir: string | undefined) => void,
        reject: (error: any) => void
    }
    protected isValidInstallationDirCB?: {
        resolve: () => void,
        reject: (error: any) => void
    };
    protected getDefaultInstallationDirCB?: {
        resolve: (dir: string) => void,
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
                    if (state) this.getAppStateCB.resolve(state);
                    else this.getAppStateCB.reject(args.length >= 2 ? args[1] : new Error('No error argument provided'));
                    this.getAppStateCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.getAppState);
                break;
            case ACTIONS.downloader.getInstallationDir:
                if (args.length < 1) throw new Error('Installation dir argument does not exist.');
                if (this.getInstallationDirCB) {
                    const dir: string | undefined | null = args[0];
                    if (dir) this.getInstallationDirCB.resolve(dir);
                    else if(args.length >= 2) this.getInstallationDirCB.reject(args[1]);
                    else this.getInstallationDirCB.resolve(undefined);
                    this.getInstallationDirCB = undefined;
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
                    this.getInstallationDirCB = undefined;
                } else console.warn('No callback defined for', ACTIONS.downloader.getDefaultInstallationDir);
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public startInstallationProcess(app: App, installationDir: string): Promise<boolean | null> {
        if(this.startInstallationProcessCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.startInstallationProcessCB = {
                resolve: success => resolve(success),
                reject: error => reject(error)
            };
            this.sendAction(ACTIONS.downloader.startInstallationProcess, app, installationDir);
        });
    }

    public getAppStatus(app: App): Promise<AppState | null> {
        if (this.getAppStateCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.getAppStateCB = {
                resolve: state => resolve(state),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.getAppState, app);
        });
    }

    public getInstallationDir(app: App): Promise<string | undefined | null> {
        if (this.getInstallationDirCB) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            this.getInstallationDirCB = {
                resolve: dir => resolve(dir),
                reject: err => reject(err)
            };
            this.sendAction(ACTIONS.downloader.getInstallationDir, app);
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
    
}('downloader'));

export const UTILITIES = registerHandler(new class extends IPCActionHandler {
    protected chooseFileCB?: {
        resolve: (dir: Electron.OpenDialogReturnValue | null) => void,
        reject: (error: any) => void
    }

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