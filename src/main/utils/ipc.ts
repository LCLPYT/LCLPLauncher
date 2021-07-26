import { ipcMain } from "electron";
import { IpcMainEvent } from "electron/main";
import App from "../../common/types/App";
import { ACTIONS, GenericIPCHandler } from "../../common/utils/ipc";
import { addToLibary } from "./library";

class IpcEvent {
    public readonly event: IpcMainEvent;
    public readonly channel: string;

    constructor(event: IpcMainEvent, channel: string) {
        this.event = event;
        this.channel = channel;
    }

    public reply(...args: any[]) {
        this.event.reply(this.channel, ...args);
    }
}

class IpcActionEvent extends IpcEvent {
    public readonly action: string;

    constructor(extend: IpcEvent, action: string) {
        super(extend.event, extend.channel);
        this.action = action;
    }

    public reply(...args: any[]) {
        this.event.reply(this.action, ...args);
    }
}

abstract class IPCHandler extends GenericIPCHandler<IpcMainEvent> {
    public onMessage(event: IpcMainEvent, args: any[]) {
        this.onMsg(new IpcEvent(event, this.channel), args);
    }

    protected abstract onMsg(event: IpcEvent, args: any[]): void;
}

abstract class IPCActionHandler extends IPCHandler {
    protected onMsg(event: IpcEvent, args: any[]) {
        if(args.length < 1) throw new Error('Action argument does not exist.');
        const action = args[0];
        const actionEvent = new IpcActionEvent(event, action);
        this.onAction(action, actionEvent, args.slice(1));
    }

    protected abstract onAction(action: string, event: IpcActionEvent, args: any[]): void
}

const IPC_HANDLERS: IPCHandler[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcMain.on(handler.channel, (event, args) => handler.onMessage(event, args)));
}

function registerHandler<T extends IPCHandler>(handler: T) {
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
            default:
                throw new Error(`Action '${action}' not implemented.`);
        }
    }
}('library'));