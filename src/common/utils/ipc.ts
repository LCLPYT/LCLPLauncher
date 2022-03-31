type ElectronIpcEvent = Electron.IpcMainEvent | Electron.IpcRendererEvent;

export abstract class GenericIPCHandler<T extends ElectronIpcEvent> {
    public readonly channel: string;

    constructor(channel: string) {
        this.channel = channel;
    }

    public abstract onMessage(event: T, ...args: any[]): void;
}

export abstract class GenericIPCActionHandler<T extends ElectronIpcEvent, U> extends GenericIPCHandler<T> {

    protected abstract getIpcEvent(event: T, action: string): U;

    public onMessage(event: T, args: any[]) {
        if(args.length < 1) throw new Error('Action argument does not exist.');
        const action = args[0];
        this.onAction(action, this.getIpcEvent(event, action), args.slice(1));
    }

    protected abstract onAction(action: string, event: U, args: any[]): void
}

export const ACTIONS = {
    library: {
        addAppToLibrary: 'add-app-to-libary',
        isAppInLibrary: 'is-app-in-library',
        getLibraryApps: 'get-library-apps',
        startApp: 'start-app',
        stopApp: 'stop-app'
    },
    downloader: {
        startInstallationProcess: 'start-installation-process',
        getAppState: 'get-app-state',
        getInstallationDir: 'get-installation-dir',
        isValidInstallationDir: 'is-valid-installation-dir',
        getDefaultInstallationDir: 'get-default-installation-dir',
        updateInstallationState: 'update-installation-state',
        updateInstallationProgress: 'update-installation-progress',
        updatePackageDownloadProgress: 'update-package-download-progress',
        uninstall: 'uninstall',
        getUninstalledDependencies: 'get-uninstalled-dependencies',
        isLauncherInstallerVersionValid: 'is-launcher-installer-version-valid',
        getAdditionalInputs: 'get-additional-inputs'
    },
    utilities: {
        chooseFile: 'choose-file',
        exitApp: 'exit-app',
        setMaximizable: 'set-maximizable',
        closeWindow: 'close-window',
        maximizeWindow: 'maximize-window',
        unmaximizeWindow: 'unmaximize-window',
        minimizeWindow: 'minimize-window',
        isWindowMaximized: 'is-window-maximized',
        getAppVersion: 'get-app-version',
        removeAllListeners: 'remove-all-listeners',
        getAppPath: 'get-app-path',
        toggleDevTools: 'toggle-dev-tools',
        toggleFullScreen: 'toggle-full-screen',
        doesFileExist: 'does-file-exist',
        changeLocationHash: 'change-location-hash',
        console_log: 'log'
    },
    toasts: {
        addToast: 'add-toast',
        removeToast: 'remove-toast'
    },
    updater: {
        sendUpdateState: 'send-update-state',
        isUpdateChecking: 'is-update-checking',
        startUpdate: 'start-update',
        skipUpdate: 'skip-update',
        sendError: 'send-error',
        sendProgress: 'send-progress'
    }
}