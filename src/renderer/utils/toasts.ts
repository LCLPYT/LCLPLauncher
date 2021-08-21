import Toast from "../../common/types/Toast";

export type ToastEvents = 'add-toast' | 'remove-toast';

export type ToastDetails = {
    toast?: Toast,
    toastId: string
}

export class ToastEvent extends CustomEvent<ToastDetails> {}

export interface ToastEventListener {
    (event: ToastEvent): void
}

export interface ToastEventListenerObject {
    handleEvent(event: ToastEvent): void;
}

export type ToastEventListenerOrObject = ToastEventListener | ToastEventListenerObject;

export class ToastManager implements EventTarget {
    protected listeners: {
        [type: string]: ToastEventListenerOrObject[]
    } = {};

    addEventListener(type: ToastEvents, listener: ToastEventListenerOrObject | null): void {
        if (!listener) return;
        if (!(type in this.listeners)) this.listeners[type] = [];
        this.listeners[type].push(listener);
    }
    dispatchEvent(event: ToastEvent): boolean {
        if (!(event.type in this.listeners)) return true;
        const stack = this.listeners[event.type].slice();

        for (let i = 0, l = stack.length; i < l; i++) {
            const listener = stack[i];
            if (isEventListener(listener)) listener.call(this, event);
            else listener.handleEvent(event);
        }
        return !event.defaultPrevented;
    }
    removeEventListener(type: ToastEvents, listener: ToastEventListenerOrObject | null): void {
        if (!listener || !(type in this.listeners)) return;
        const stack = this.listeners[type];
        for (let i = 0, l = stack.length; i < l; i++) {
            if (stack[i] === listener) {
                stack.splice(i, 1);
                return;
            }
        }
    }
}

export declare interface ToastManager {
    addEventListener(type: string, listener: ToastEventListenerOrObject | null): void
    removeEventListener(type: string, listener: ToastEventListenerOrObject | null): void
}

function isEventListener(listener: ToastEventListenerOrObject): listener is ToastEventListener {
    return (<ToastEventListener> listener).call !== undefined;
}

export const toastManager = new ToastManager();

export function addToast(toast: Toast) {
    toastManager.dispatchEvent(new CustomEvent('add-toast', {
        detail: {
            toast: toast,
            toastId: toast.id
        }
    }));
}

export function removeToast(toastId: string) {
    toastManager.dispatchEvent(new CustomEvent('remove-toast', {
        detail: {
            toastId: toastId
        }
    }));
}