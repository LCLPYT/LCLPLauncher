type Toast = {
    id: string,
    icon?: string,
    title: string,
    type: ToastType,
    noAutoHide?: boolean,
    autoHideDelay?: number
}

export enum ToastType {
    DOWNLOAD_STATUS
}

export default Toast;