import AppDependency from "../../common/types/AppDependency";

export type DependencyEvents = 'set-dependencies';

export type DependencyDetails = {
    dependencies?: AppDependency[],
    show?: boolean,
    callback?: () => void
}

export class DependenciesEvent extends CustomEvent<DependencyDetails> {}

export interface DependenciesEventListener {
    (event: DependenciesEvent): void
}

export interface DependenciesEventListenerObject {
    handleEvent(event: DependenciesEvent): void;
}

export type DependenciesEventListenerOrObject = DependenciesEventListener | DependenciesEventListenerObject;

export class DependenciesManager implements EventTarget {
    protected listeners: {
        [type: string]: DependenciesEventListenerOrObject[]
    } = {};

    addEventListener(type: DependencyEvents, listener: DependenciesEventListenerOrObject | null): void {
        if (!listener) return;
        if (!(type in this.listeners)) this.listeners[type] = [];
        this.listeners[type].push(listener);
    }
    dispatchEvent(event: DependenciesEvent): boolean {
        if (!(event.type in this.listeners)) return true;
        const stack = this.listeners[event.type].slice();

        for (let i = 0, l = stack.length; i < l; i++) {
            const listener = stack[i];
            if (isEventListener(listener)) listener.call(this, event);
            else listener.handleEvent(event);
        }
        return !event.defaultPrevented;
    }
    removeEventListener(type: DependencyEvents, listener: DependenciesEventListenerOrObject | null): void {
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

export declare interface DependenciesManager {
    addEventListener(type: string, listener: DependenciesEventListenerOrObject | null): void
    removeEventListener(type: string, listener: DependenciesEventListenerOrObject | null): void
}

function isEventListener(listener: DependenciesEventListenerOrObject): listener is DependenciesEventListener {
    return (<DependenciesEventListener> listener).call !== undefined;
}

export const dependenciesManager = new DependenciesManager();

export function setDependencies(dependencies: AppDependency[], show?: boolean, callback?: () => void) {
    dependenciesManager.dispatchEvent(new CustomEvent('set-dependencies', {
        detail: {
            dependencies: dependencies,
            show: show,
            callback: callback
        }
    }));
}