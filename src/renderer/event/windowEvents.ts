export type WindowEvents = 'maximizable-change';

export type WindowDetails = {
    maximizable?: boolean
}

export class WindowEvent extends CustomEvent<WindowDetails> {}

export interface WindowEventListener {
    (event: WindowEvent): void
}

export interface WindowEventListenerObject {
    handleEvent(event: WindowEvent): void;
}

export type WindowEventListenerOrObject = WindowEventListener | WindowEventListenerObject;

export class WindowManager implements EventTarget {
    protected listeners: {
        [type: string]: WindowEventListenerOrObject[]
    } = {};

    addEventListener(type: WindowEvents, listener: WindowEventListenerOrObject | null): void {
        if (!listener) return;
        if (!(type in this.listeners)) this.listeners[type] = [];
        this.listeners[type].push(listener);
    }
    dispatchEvent(event: WindowEvent): boolean {
        if (!(event.type in this.listeners)) return true;
        const stack = this.listeners[event.type].slice();

        for (let i = 0, l = stack.length; i < l; i++) {
            const listener = stack[i];
            if (isEventListener(listener)) listener.call(this, event);
            else listener.handleEvent(event);
        }
        return !event.defaultPrevented;
    }
    removeEventListener(type: WindowEvents, listener: WindowEventListenerOrObject | null): void {
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

export declare interface WindowManager {
    addEventListener(type: string, listener: WindowEventListenerOrObject | null): void
    removeEventListener(type: string, listener: WindowEventListenerOrObject | null): void
}

function isEventListener(listener: WindowEventListenerOrObject): listener is WindowEventListener {
    return (<WindowEventListener> listener).call !== undefined;
}

export const windowManager = new WindowManager();

export function setWindowMaximizable(maximizable: boolean) {
    windowManager.dispatchEvent(new CustomEvent('maximizable-change', {
        detail: {
            maximizable: maximizable
        }
    }));
}