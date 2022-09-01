export type Listener<T> = (msg: T) => void;

export interface INotifier<T> {
    bind(listener: Listener<T>): void;
    unbind(listener: Listener<T>): void;
    notify(msg: T): void;
}

export default class Notifier<T> implements INotifier<T> {
    private listeners: Listener<T>[] = [];

    public bind(listener: Listener<T>) {
        this.listeners.push(listener);
    }

    public unbind(listener?: Listener<T>) {
        if (!listener) {
            this.listeners = [];
        } else {
            const idx = this.listeners.indexOf(listener);
            if (idx >= 0) this.listeners.splice(idx, 1);
        }
    }

    public notify(msg: T): void {
        this.listeners.forEach(l => l(msg));
    }
}