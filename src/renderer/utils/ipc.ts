import { ipcRenderer } from "electron";
import { IpcRendererEvent } from "electron/renderer";
import App from "../../common/types/App";
import { ACTIONS, GenericIPCHandler } from "../../common/utils/ipc";

abstract class IPCHandler extends GenericIPCHandler<IpcRendererEvent> {
    public sendRawMessage(...args: any[]) {
        ipcRenderer.send(this.channel, args);
    }

    public sendMessage(action: string, ...args: any[]) {
        this.sendRawMessage(action, ...args);
    }
}

const IPC_HANDLERS: IPCHandler[] = [];

export function initIPC() {
    IPC_HANDLERS.forEach(handler => ipcRenderer.on(handler.channel, (event, args) => handler.onMessage(event, args)));
}

function registerHandler<T extends IPCHandler>(handler: T) {
    IPC_HANDLERS.push(handler);
    return handler;
}

export const LIBRARY = registerHandler(new class extends IPCHandler {
    public onMessage(event: Electron.IpcRendererEvent, ...args: any[]): void {
        throw new Error("Method not implemented.");
    }

    public addAppToLibrary(app: App) {
        this.sendMessage(ACTIONS.library.addAppToLibrary, app);
    }
}('library'));