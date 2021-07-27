import { ipcRenderer } from "electron";
import { IpcRendererEvent } from "electron/renderer";
import App from "../../common/types/App";
import { ACTIONS, GenericIPCActionHandler, GenericIPCHandler } from "../../common/utils/ipc";

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
}('library'));