type ElectronIpcEvent = Electron.IpcMainEvent | Electron.IpcRendererEvent;

export abstract class GenericIPCHandler<T extends ElectronIpcEvent> {
    public readonly channel: string;

    constructor(channel: string) {
        this.channel = channel;
    }

    public abstract onMessage(event: T, ...args: any[]): void;
}

export abstract class GenericIPCActionHandler<T extends ElectronIpcEvent, U> extends GenericIPCHandler<T> {

    protected abstract getIpcEvent(event: T, action: string): U;

    public onMessage(event: T, args: any[]) {
        if(args.length < 1) throw new Error('Action argument does not exist.');
        const action = args[0];
        this.onAction(action, this.getIpcEvent(event, action), args.slice(1));
    }

    protected abstract onAction(action: string, event: U, args: any[]): void
}

export const ACTIONS = {
    library: {
        addAppToLibrary: 'add-app-to-libary',
        isAppInLibrary: 'is-app-in-library',
        getLibraryApps: 'get-library-apps'
    },
    downloader: {
        startInstallationProcess: 'start-installation-process'
    }
}