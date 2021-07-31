import { ipcMain } from "electron";
import { IpcMainEvent } from "electron/main";
import App from "../../common/types/App";
import { ACTIONS, GenericIPCActionHandler, GenericIPCHandler } from "../../common/utils/ipc";
import { addToLibary, getLibraryApps, isInLibrary } from "./library";

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
}

const IPC_HANDLERS: GenericIPCHandler<IpcMainEvent>[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcMain.on(handler.channel, (event, args) => handler.onMessage(event, args)));
}

function registerHandler<T extends GenericIPCHandler<IpcMainEvent>>(handler: T) {
    IPC_HANDLERS.push(handler);
    return handler;
}

export const LIBRARY = registerHandler(new class extends IPCActionHandler {
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