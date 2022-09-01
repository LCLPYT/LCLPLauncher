import type ToastInfo from "../../../common/types/Toast";
import { ToastType } from "../../../common/types/Toast";
import { TOASTS } from "../../utils/ipc";
import { getMainWindow } from "../window";

export namespace Toast {
    type ToastLike = ToastInfo | Omit<ToastInfo, 'id'>;

    let queue: ToastInfo[] = [];
    let nextToastId = 0;

    function getNextToastId() {
        return nextToastId++;
    }

    export function create(toastInfo: Omit<ToastInfo, 'id'>): ToastInfo {
        return {
            id: getNextToastId(),
            ...toastInfo
        };
    }

    export function createError(title: string, detail?: string): ToastInfo {
        const toast: ToastInfo = {
            id: getNextToastId(),
            icon: 'error',
            title: title,
            type: ToastType.TEXT
        };

        if (detail) toast.detail = detail;

        return toast;
    }

    export function add(toast: ToastLike): number {
        const info = isToastInfo(toast) ? toast : create(toast);

        if (!getMainWindow()) {
            if (queue.length > 100) queue.shift();
            queue.push(info);
        } else {
            TOASTS.addToast(info);
        }

        return info.id;
    }
    
    export function remove(id: number) {
        if (queue.length > 0) {
            queue = queue.filter(toast => toast.id !== id);
        } else {
            TOASTS.removeToast(id);
        }
    }

    export function flush() {
        if (!getMainWindow()) return;

        while (queue.length > 0) {
            const next = queue.shift();
            if (next) TOASTS.addToast(next);
        }
    }

    function isToastInfo(toast: ToastLike): toast is ToastInfo {
        return (toast as ToastInfo).id !== undefined;
    }
}