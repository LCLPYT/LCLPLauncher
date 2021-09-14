import { app, dialog, ipcMain } from "electron";
import { autoUpdater, ProgressInfo } from "electron-updater";
import { IpcMainEvent } from "electron/main";
import App from "../../common/types/App";
import AppState from "../../common/types/AppState";
import DownloadProgress, { PackageDownloadProgress } from "../../common/types/DownloadProgress";
import InstallationInputResult from "../../common/types/InstallationInputResult";
import Toast from "../../common/types/Toast";
import UpdateCheckResult from "../../common/types/UpdateCheckResult";
import { isDevelopment } from "../../common/utils/env";
import { ACTIONS, GenericIPCActionHandler, GenericIPCHandler } from "../../common/utils/ipc";
import { getAppState, validateInstallationDir, startInstallationProcess, getUninstalledDependencies, isInstallationLauncherVersionValid, fetchAdditionalInputs } from "../downloader/downloader";
import { readInputMap } from "../downloader/inputs";
import { getInstallationDirectory } from "../downloader/installedApps";
import { uninstallApp } from "../downloader/uninstall";
import { isRunningAsAppImage } from "./env";
import { exists, getOrCreateDefaultInstallationDir } from "./fshelper";
import { addToLibary, getLibraryApps, isInLibrary } from "./library";
import { isPlatform } from "./oshooks";
import { startApp, stopApp } from "./startup";
import { freeWindow, getUpdateCheckResult, getUpdateError, isUpdateChecking } from "./updater";
import { getMainWindow } from "./window";

class IpcActionEvent {
    public readonly event: IpcMainEvent;
    public readonly channel: string;
    public readonly action: string;

    constructor(event: IpcMainEvent, channel: string, action: string) {
        this.event = event;
        this.channel = channel;
        this.action = action;
    }

    public reply(...args: any[]) {
        this.event.reply(this.channel, [this.action, ...args]);
    }
}

abstract class IPCActionHandler extends GenericIPCActionHandler<IpcMainEvent, IpcActionEvent> {
    protected getIpcEvent(event: IpcMainEvent, action: string): IpcActionEvent {
        return new IpcActionEvent(event, this.channel, action);
    }

    public sendRawMessage(...args: any[]) {
        const window = getMainWindow();
        if (!window) throw new Error('Could not find main window');
        window.webContents.send(this.channel, args);
    }

    public sendAction(action: string, ...args: any[]) {
        this.sendRawMessage(action, ...args);
    }
}

const IPC_HANDLERS: GenericIPCHandler<IpcMainEvent>[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcMain.on(handler.channel, (event, args) => handler.onMessage(event, args)));
}

function registerHandler<T extends GenericIPCHandler<IpcMainEvent>>(handler: T) {
    IPC_HANDLERS.push(handler);
    return handler;
}

registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, event: IpcActionEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.library.addAppToLibrary:
                if (args.length < 1) throw new Error('App argument is missing');
                addToLibary(<App>args[0])
                    .then(() => event.reply(true))
                    .catch(err => {
                        console.error('Error adding library app:', err);
                        event.reply(false);
                    });
                break;
            case ACTIONS.library.isAppInLibrary:
                if (args.length < 1) throw new Error('App argument is missing');
                isInLibrary(<App>args[0])
                    .then(inLibrary => event.reply(inLibrary))
                    .catch(err => {
                        console.error('Error checking for library app:', err);
                        event.reply(false);
                    });
                break;
            case ACTIONS.library.getLibraryApps:
                getLibraryApps()
                    .then(apps => event.reply(apps))
                    .catch(err => {
                        console.error('Error getting library apps:', err);
                        event.reply(null);
                    })
                break;
            case ACTIONS.library.startApp:
                if (args.length < 1) throw new Error('App argument is missing');
                startApp(args[0])
                    .then(() => event.reply(null))
                    .catch(err => {
                        console.error('Error starting app:', err);
                        event.reply(err);
                    });
                break;
            case ACTIONS.library.stopApp:
                if (args.length < 1) throw new Error('App argument is missing');
                try {
                    event.reply(stopApp(args[0]));
                } catch (err) {
                    console.error('Error stopping app:', err);
                    event.reply(err);
                }
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }
}('library'));

export const DOWNLOADER = registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, event: IpcActionEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.downloader.startInstallationProcess:
                if (args.length < 3) throw new Error('App, installation directory, input map arguments are missing');
                startInstallationProcess(args[0], args[1], args[2])
                    .then(() => event.reply(true))
                    .catch(err => {
                        console.error('Error in installation process:', err);
                        event.reply(false, err);
                    });
                break;
            case ACTIONS.downloader.getAppState:
                if (args.length < 1) throw new Error('App argument is missing');
                getAppState(<App>args[0])
                    .then(state => event.reply(state))
                    .catch(err => {
                        console.error('Error checking app state:', err);
                        event.reply(null, err);
                    });
                break;
            case ACTIONS.downloader.getInstallationDir:
                if (args.length < 1) throw new Error('App argument is missing');
                getInstallationDirectory(args[0])
                    .then(path => event.reply(path))
                    .catch(err => event.reply(null, err));
                break;
            case ACTIONS.downloader.isValidInstallationDir:
                if (args.length < 1) throw new Error('Installation directory argument is missing');
                validateInstallationDir(args[0])
                    .then(() => event.reply(null))
                    .catch(err => event.reply(err));
                break;
            case ACTIONS.downloader.getDefaultInstallationDir:
                if (args.length < 1) throw new Error('App argument is missing');
                getOrCreateDefaultInstallationDir(args[0])
                    .then(dir => event.reply(dir))
                    .catch(err => event.reply(null, err));
                break;
            case ACTIONS.downloader.uninstall:
                if (args.length < 1) throw new Error('App argument is missing');
                uninstallApp(args[0])
                    .then(() => event.reply(null))
                    .then(err => event.reply(err));
                break;
            case ACTIONS.downloader.getUninstalledDependencies:
                if (args.length < 1) throw new Error('App argument is missing');
                getUninstalledDependencies(args[0])
                    .then(deps => event.reply(deps))
                    .catch(err => event.reply(null, err));
                break;
            case ACTIONS.downloader.isLauncherInstallerVersionValid:
                if (args.length < 1) throw new Error('App argument is missing');
                isInstallationLauncherVersionValid(args[0])
                    .then(valid => event.reply(valid))
                    .catch(err => event.reply(null, err));
                break;
            case ACTIONS.downloader.getAdditionalInputs:
                if (args.length < 2) throw new Error('App and installation dir arguments are missing');
                const app = args[0];
                readInputMap(app).then(map => {
                    fetchAdditionalInputs(app, args[1], map).then(inputs => {
                        event.reply(<InstallationInputResult>{
                            inputs: inputs,
                            map: map
                        });
                    }).catch(err => event.reply(null, err));
                }).catch(err => console.error('Could not read input map:', err));
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public updateInstallationState(state?: AppState) {
        this.sendAction(ACTIONS.downloader.updateInstallationState, state);
    }

    public updateInstallationProgress(progress: DownloadProgress) {
        this.sendAction(ACTIONS.downloader.updateInstallationProgress, progress);
    }

    public updatePackageDownloadProgress(progress: PackageDownloadProgress) {
        this.sendAction(ACTIONS.downloader.updatePackageDownloadProgress, progress);
    }
}('downloader'));

export const UTILITIES = registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, event: IpcActionEvent, args: any[]): void {
        switch (action) {
            case ACTIONS.utilities.chooseFile:
                if (args.length < 1) throw new Error('Options argument is missing');
                const options = <Electron.OpenDialogOptions>args[0];

                const focusedWindow = getMainWindow();
                if (!focusedWindow) {
                    event.reply(null, new Error('Main window not found'));
                } else {
                    dialog.showOpenDialog(focusedWindow, options)
                        .then(result => event.reply(result))
                        .catch(err => event.reply(null, err));
                }
                break;
            case ACTIONS.utilities.exitApp:
                app.exit();
                break;
            case ACTIONS.utilities.closeWindow:
                getMainWindow()?.close();
                break;
            case ACTIONS.utilities.maximizeWindow:
                getMainWindow()?.maximize();
                break;
            case ACTIONS.utilities.unmaximizeWindow:
                getMainWindow()?.unmaximize();
                break;
            case ACTIONS.utilities.minimizeWindow:
                getMainWindow()?.minimize();
                break;
            case ACTIONS.utilities.isWindowMaximized:
                const mainWindow = getMainWindow();
                if (!mainWindow) event.reply(null);
                else event.reply(mainWindow.isMaximized());
                break;
            case ACTIONS.utilities.getAppVersion:
                event.reply(app.getVersion());
                break;
            case ACTIONS.utilities.removeAllListeners:
                getMainWindow()?.removeAllListeners();
                break;
            case ACTIONS.utilities.getAppPath:
                event.reply(app.getAppPath());
                break;
            case ACTIONS.utilities.toggleDevTools:
                getMainWindow()?.webContents.toggleDevTools();
                break;
            case ACTIONS.utilities.toggleFullScreen:
                const win = getMainWindow();
                if (win) {
                    if (win.isFullScreen()) win.setFullScreen(false);
                    else win.setFullScreen(true);
                }
                break;
            case ACTIONS.utilities.doesFileExist:
                if (args.length < 1) throw new Error('File argument does not exist.');
                exists(args[0])
                    .then(exists => event.reply(args[0], exists))
                    .catch(err => event.reply(args[0], null, err));
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public setMaximizable(maximizable: boolean) {
        this.sendAction(ACTIONS.utilities.setMaximizable, maximizable);
    }
}('utilities'));

export const TOASTS = registerHandler(new class extends IPCActionHandler {
    protected nextToastId = 0;

    protected onAction(): void { }

    public getNextToastId() {
        return this.nextToastId++;
    }

    public addToast(toast: Toast) {
        this.sendAction(ACTIONS.toasts.addToast, toast);
    }

    public removeToast(toastId: number) {
        this.sendAction(ACTIONS.toasts.removeToast, toastId);
    }

}('toasts'));

export const UPDATER = registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, event: IpcActionEvent): void {
        switch (action) {
            case ACTIONS.updater.isUpdateChecking:
                event.reply(isUpdateChecking(), getUpdateCheckResult(), getUpdateError());
                break;
            case ACTIONS.updater.skipUpdate:
                const mainWindow = getMainWindow();
                if (!mainWindow) throw new Error('Could not find main window.');

                freeWindow(mainWindow);
                this.sendUpdateState({ updateAvailable: false }); // continue to main window
                break;
            case ACTIONS.updater.startUpdate:
                try {
                    if (isDevelopment) event.reply(null);
                    else {
                        if (isPlatform('linux') && !isRunningAsAppImage()) {
                            const mainWindow = getMainWindow();
                            if (!mainWindow) throw new Error('Could not get main window.');
                            dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                message: 'Your installation does not support internal auto updating. Please update the app manually; e.g. with your package manager.',
                                title: 'Manual update required'
                            });
                        } else {
                            autoUpdater.downloadUpdate();
                            event.reply(null);
                        }
                    }
                } catch (err) {
                    event.reply(err);
                }
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public sendUpdateState(state: UpdateCheckResult) {
        this.sendAction(ACTIONS.updater.sendUpdateState, state);
    }

    public sendUpdateError(err: any) {
        this.sendAction(ACTIONS.updater.sendError, err);
    }

    public sendUpdateProgress(progress: ProgressInfo) {
        this.sendAction(ACTIONS.updater.sendProgress, progress);
    }
}('updater'));