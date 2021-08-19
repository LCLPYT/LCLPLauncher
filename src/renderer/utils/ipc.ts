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
}('downloader'))