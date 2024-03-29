import { ProgressInfo } from "electron-updater";
import UpdateCheckResult from "../../common/types/UpdateCheckResult";

export type UpdaterEvents = 'update-error' | 'update-progress';

export type UpdaterDetails = {
    state?: UpdateCheckResult,
    error?: any,
    progress?: ProgressInfo
}

export class UpdaterEvent extends CustomEvent<UpdaterDetails> {}

export interface UpdaterEventListener {
    (event: UpdaterEvent): void
}

export interface UpdaterEventListenerObject {
    handleEvent(event: UpdaterEvent): void;
}

export type UpdaterEventListenerOrObject = UpdaterEventListener | UpdaterEventListenerObject;

export class UpdaterManager implements EventTarget {
    protected queue: UpdaterEvent[] = [];
    protected mounted = false;
    protected listeners: {
        [type: string]: UpdaterEventListenerOrObject[]
    } = {};

    addEventListener(type: UpdaterEvents, listener: UpdaterEventListenerOrObject | null): void {
        if (!listener) return;
        if (!(type in this.listeners)) this.listeners[type] = [];
        this.listeners[type].push(listener);

        if (!this.mounted) {
            this.mounted = true;

            while (this.queue.length > 0) {
                const next = this.queue.shift();
                if (!next) break;

                this.dispatchEvent(next);
            }
        }
    }

    dispatchEvent(event: UpdaterEvent): boolean {
        if (!this.mounted) {
            if (this.queue.length >= 100) this.queue.shift();
            this.queue.push(event);
            return true;
        }
        
        if (!(event.type in this.listeners)) return true;
        const stack = this.listeners[event.type].slice();

        for (let i = 0, l = stack.length; i < l; i++) {
            const listener = stack[i];
            if (isEventListener(listener)) listener.call(this, event);
            else listener.handleEvent(event);
        }
        return !event.defaultPrevented;
    }

    removeEventListener(type: UpdaterEvents, listener: UpdaterEventListenerOrObject | null): void {
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

export declare interface UpdaterManager {
    addEventListener(type: string, listener: UpdaterEventListenerOrObject | null): void
    removeEventListener(type: string, listener: UpdaterEventListenerOrObject | null): void
}

function isEventListener(listener: UpdaterEventListenerOrObject): listener is UpdaterEventListener {
    return (<UpdaterEventListener> listener).call !== undefined;
}

export const updaterManager = new UpdaterManager();
let updateState: UpdateCheckResult | undefined = undefined;

export function setUpdateState(state: UpdateCheckResult) {
    updateState = state;
}

export function getUpdateState() {
    return updateState;
}

export function postUpdateError(err: any) {
    updaterManager.dispatchEvent(new CustomEvent('update-error', {
        detail: {
            error: err
        }
    }));
}

export function postUpdateProgress(progress: ProgressInfo) {
    updaterManager.dispatchEvent(new CustomEvent('update-progress', {
        detail: {
            progress: progress
        }
    }));
}