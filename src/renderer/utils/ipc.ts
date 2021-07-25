import { ipcRenderer } from "electron";
import { IpcRendererEvent } from "electron/renderer";
import { GenericIPCHandler } from "../../common/utils/ipc";

abstract class IPCHandler extends GenericIPCHandler<IpcRendererEvent> {
    public sendMessage(...args: any[]) {
        ipcRenderer.send(this.channel, args);
    }
}

const IPC_HANDLERS: IPCHandler[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcRenderer.on(handler.channel, handler.onMessage));
}

function registerHandler<T extends IPCHandler>(handler: T) {
    IPC_HANDLERS.push(handler);
    return handler;
}

export const LIBRARY = registerHandler(new class extends IPCHandler {
    public onMessage(event: Electron.IpcRendererEvent, ...args: any[]): void {
        throw new Error("Method not implemented.");
    }
}('library'));