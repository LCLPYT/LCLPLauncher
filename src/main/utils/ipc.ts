import { dialog, ipcMain } from "electron";
import { IpcMainEvent } from "electron/main";
import App from "../../common/types/App";
import AppState from "../../common/types/AppState";
import DownloadProgress from "../../common/types/DownloadProgress";
import Toast from "../../common/types/Toast";
import { ACTIONS, GenericIPCActionHandler, GenericIPCHandler } from "../../common/utils/ipc";
import { getAppState, getInstallationDirectory, validateInstallationDir, startInstallationProcess } from "../downloader/downloader";
import { uninstallApp } from "../downloader/uninstall";
import { getOrCreateDefaultInstallationDir } from "./fshelper";
import { addToLibary, getLibraryApps, isInLibrary } from "./library";
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
        switch(action) {
            case ACTIONS.library.addAppToLibrary:
                if(args.length < 1) throw new Error('App argument is missing');
                addToLibary(<App> args[0])
                    .then(() => event.reply(true))
                    .catch(err => {
                        console.error('Error adding library app:', err);
                        event.reply(false);
                    });
                break;
            case ACTIONS.library.isAppInLibrary:
                if(args.length < 1) throw new Error('App argument is missing');
                isInLibrary(<App> args[0])
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
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }
}('library'));

export const DOWNLOADER = registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, event: IpcActionEvent, args: any[]): void {
        switch(action) {
            case ACTIONS.downloader.startInstallationProcess:
                if(args.length < 2) throw new Error('App, installation directory arguments are missing');
                startInstallationProcess(<App> args[0], <string> args[1])
                    .then(() => event.reply(true))
                    .catch(err => {
                        console.error('Error in installation process:', err);
                        event.reply(false, err);
                    });
                break;
            case ACTIONS.downloader.getAppState:
                if(args.length < 1) throw new Error('App argument is missing');
                getAppState(<App> args[0])
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
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }

    public updateInstallationState(state: AppState) {
        this.sendAction(ACTIONS.downloader.updateInstallationState, state);
    }

    public updateInstallationProgress(progress: DownloadProgress) {
        this.sendAction(ACTIONS.downloader.updateInstallationProgress, progress);
    }
}('downloader'));

registerHandler(new class extends IPCActionHandler {
    protected onAction(action: string, event: IpcActionEvent, args: any[]): void {
        switch(action) {
            case ACTIONS.utilities.chooseFile:
                if (args.length < 1) throw new Error('Options argument is missing');
                const options = <Electron.OpenDialogOptions> args[0];

                const focusedWindow = getMainWindow();
                if (!focusedWindow) {
                    event.reply(null, new Error('Main window not found'));
                } else {
                    dialog.showOpenDialog(focusedWindow, options)
                        .then(result => event.reply(result))
                        .catch(err => event.reply(null, err));
                }
                break;
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }
}('utilities'));

export const TOASTS = registerHandler(new class extends IPCActionHandler {
    protected nextToastId = 0;

    protected onAction(): void {}

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