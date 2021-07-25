import { ipcMain } from "electron";
import { IpcMainEvent } from "electron/main";
import { GenericIPCHandler } from "../../common/utils/ipc";

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

abstract class IPCHandler extends GenericIPCHandler<IpcMainEvent> {
    public onMessage(event: IpcMainEvent, ...args: any[]) {
        this.onMsg(new IpcEvent(event, this.channel), args);
    }

    protected abstract onMsg(event: IpcEvent, ...args: any[]): void;
}

const IPC_HANDLERS: IPCHandler[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcMain.on(handler.channel, handler.onMessage));
}

function registerHandler<T extends IPCHandler>(handler: T) {
    IPC_HANDLERS.push(handler);
    return handler;
}

export const LIBRARY = registerHandler(new class extends IPCHandler {
    public onMsg(event: IpcEvent, ...args: any[]): void {
        throw new Error("Method not implemented.");
    }
}('library'));