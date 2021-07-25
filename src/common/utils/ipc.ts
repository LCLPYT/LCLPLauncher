export abstract class GenericIPCHandler<T extends Electron.IpcMainEvent | Electron.IpcRendererEvent> {
    public readonly channel: string;

    constructor(channel: string) {
        this.channel = channel;
    }

    public abstract onMessage(event: T, ...args: any[]): void;
}