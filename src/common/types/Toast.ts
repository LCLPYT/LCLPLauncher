type Toast = {
    id: number,
    icon?: string,
    title: string,
    type: ToastType,
    noAutoHide?: boolean,
    autoHideDelay?: number,
    detail?: any,
    noSound?: boolean
}

export enum ToastType {
    TEXT,
    DOWNLOAD_STATUS,
    PACKAGE_DOWNLOAD_STATUS,
    UPDATE_AVAILABLE
}

export default Toast;