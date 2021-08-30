import AppState from "../../common/types/AppState";
import DownloadProgress from "../../common/types/DownloadProgress";

export type InstallerEvents = 'update-state' | 'update-progress';

export type InstallerDetails = {
    currentState?: AppState,
    progress?: DownloadProgress
}

export class InstallerEvent extends CustomEvent<InstallerDetails> {}

export interface InstallerEventListener {
    (event: InstallerEvent): void
}

export interface InstallerEventListenerObject {
    handleEvent(event: InstallerEvent): void;
}

export type InstallerEventListenerOrObject = InstallerEventListener | InstallerEventListenerObject;

export class InstallationProgressManager implements EventTarget {
    protected listeners: {
        [type: string]: InstallerEventListenerOrObject[]
    } = {};

    addEventListener(type: InstallerEvents, listener: InstallerEventListenerOrObject | null): void {
        if (!listener) return;
        if (!(type in this.listeners)) this.listeners[type] = [];
        this.listeners[type].push(listener);
    }
    dispatchEvent(event: InstallerEvent): boolean {
        if (!(event.type in this.listeners)) return true;
        const stack = this.listeners[event.type].slice();

        for (let i = 0, l = stack.length; i < l; i++) {
            const listener = stack[i];
            if (isEventListener(listener)) listener.call(this, event);
            else listener.handleEvent(event);
        }
        return !event.defaultPrevented;
    }
    removeEventListener(type: InstallerEvents, listener: InstallerEventListenerOrObject | null): void {
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

export declare interface InstallationProgressManager {
    addEventListener(type: string, listener: InstallerEventListenerOrObject | null): void
    removeEventListener(type: string, listener: InstallerEventListenerOrObject | null): void
}

function isEventListener(listener: InstallerEventListenerOrObject): listener is InstallerEventListener {
    return (<InstallerEventListener> listener).call !== undefined;
}

export const installationProgressManager = new InstallationProgressManager();

export function updateInstallationState(state: AppState) {
    installationProgressManager.dispatchEvent(new CustomEvent('update-state', {
        detail: {
            currentState: state
        }
    }));
}

export function updateInstallationProgress(progress: DownloadProgress) {
    installationProgressManager.dispatchEvent(new CustomEvent('update-progress', {
        detail: {
            progress: progress
        }
    }));
}