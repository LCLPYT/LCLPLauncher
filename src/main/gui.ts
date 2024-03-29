import { app, BrowserWindow, nativeImage, nativeTheme, shell } from "electron";
import log from "electron-log";
import path from "path";
import { ToastType } from "../common/types/Toast";
import { isDevelopment } from "../common/utils/env";
import { translate } from "../common/utils/i18n";
import { Settings } from "../common/utils/settings";
import { isExternalResource } from "../common/utils/urls";
import { Toast } from "./core/service/toast";
import { setCachedCheckResult } from "./core/updater/updateResultCache";
import { setMainWindow, setWindowReady } from "./core/window";
import { executeUrlCommand, getParsedArgv, parseArgv } from "./utils/argv";
import { customWords } from "./utils/dictionary";
import { shouldUseGuiFrame } from "./utils/oshooks";

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;
let appWasReady = false;

app.on('ready', () => {
    appWasReady = true;

    // app.getLocale() is only available after 'ready' event
    import('./core/service/i18n').then(({initI18n}) => initI18n(app.getLocale()));
});

export function startup() {
    const lock = app.requestSingleInstanceLock();
    if (!lock) {
        app.quit();
        return;
    }

    app.on('second-instance', handleSecondInstance);

    // open gui as ASAP to benefit UX
    log.info('Dispatching GUI start with loading indicator when ready...');
    openGuiWhenReady();

    // initialize dependencies, such as database
    initDependencies().then(() => log.info('App dependencies are resolved, now displaying front-end...'));

    // quit application when all windows are closed
    app.on('window-all-closed', () => {
        // on macOS, it is common for applications to stay open until the user explicitly quits
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        // on macOS, it is common to re-create a window even after all windows have been closed
        if (mainWindow === null) {
            displayMainWindow().then(window => {
                mainWindow = window;
                setMainWindow(mainWindow);
            });
        }
    });
}

async function initDependencies() {
    if (process.defaultApp) {
        if (process.argv.length >= 2) app.setAsDefaultProtocolClient('lclplauncher', process.execPath, [path.resolve(process.argv[1])]);
    } else {
        app.setAsDefaultProtocolClient('lclplauncher');
    }

    // init IPC
    const {initIPC, UTILITIES, UPDATER, SYSTEM} = await import('./utils/ipc');
    initIPC();

    const whenIpcReady = SYSTEM.whenIpcReady();
    whenIpcReady.then(() => log.info('The window is now shown. IPC is now active.'));
    whenIpcReady.then(() => Toast.flush());

    // init settings
    Settings.init();

    // auto update
    const {checkForUpdates} = await import('./core/updater/updateChecker');
    const updateCheckResult = await checkForUpdates().then(res => {
        setCachedCheckResult(res);
        return res;
    }).catch(err => {
        log.error('Could not check for updates:', err);

        whenIpcReady.then(() => {
            UPDATER.sendUpdateError(err);
            Toast.add(Toast.createError(translate('toast.update_error')));
            if (mainWindow) mainWindow.setTitle(translate('title.update_error', translate('app.name')));
        });

        return null;
    });

    if (!updateCheckResult || (updateCheckResult.updateAvailable && !!updateCheckResult.mandatory)) {
        // a mandatory update is required or an error occurred whilst checking.
        // stop all other tasks and handle update in render thread
        if (updateCheckResult) {
            log.info('Mandatory update required.');

            await whenIpcReady.then(() => {
                UPDATER.sendUpdateState(updateCheckResult);
                if (mainWindow) mainWindow.setTitle(translate('title.mandatory_update', translate('app.name')));
            });
        }

        whenIpcReady.then(() => UTILITIES.sendAppReadySignal());
        return;
    } else {
        if (updateCheckResult.updateAvailable) {
            log.info(updateCheckResult.versionName ? `Update available: Version ${updateCheckResult.versionName}` : 'Update available.');

            whenIpcReady.then(() => {
                Toast.add({
                    icon: 'info',
                    title: translate('toast.update_available'),
                    type: ToastType.UPDATE_AVAILABLE,
                    detail: updateCheckResult.versionName,
                    noAutoHide: true,
                    noSound: true
                });
            });
        } else {
            log.info('No update available; already up-to-date.');
        }
    }

    // do those tasks in parallel
    await Promise.all([
        import('./database/database')
            .then(({initDatabase}) => initDatabase())
            .then(() => log.info('Database initialized.')),
        // ...
    ]);

    // finally, send ready event
    whenIpcReady.then(() => UTILITIES.sendAppReadySignal());
}

function openGuiWhenReady() {
    if (appWasReady) {
        openGui();
    } else {
        // create main BrowserWindow when electron is ready
        app.on('ready', openGui);
    }
}

let appGuiStarted = false;

function openGui() {
    if (appGuiStarted) return;
    appGuiStarted = true;

    nativeTheme.themeSource = 'dark';
    displayMainWindow().then(window => {
        mainWindow = window;
        setMainWindow(mainWindow);
    });
}

/**
 * Creates the main window of the application.
 * @returns The main window.
 */
async function displayMainWindow(): Promise<BrowserWindow> {
    let icon: Electron.NativeImage | undefined;
    if (isDevelopment) {
        const logoData = await import("../renderer/img/logo.png") as any;
        icon = nativeImage.createFromDataURL(<string> <unknown> logoData.default);
    }

    const useFrame = shouldUseGuiFrame();

    const window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,  // TODO disable this and context Isolation
            contextIsolation: false
        },
        show: false,
        frame: useFrame,
        backgroundColor: '#24292E',
        width: 1000,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        title: 'LCLPLauncher',
        icon: icon,
    });

    window.removeMenu();

    const location = getParsedArgv()?.location;
    const tag = location ? location : '';

    if (isDevelopment) {
        log.debug(`Loading content from: http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}...`)
        window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}/#${tag}`).catch(e => console.error(e));
    } else {
        window.loadFile(`${__dirname}/index.html`, {
            hash: tag
        }).catch(e => log.error(e));
    }

    /* window events */

    window.on('closed', () => mainWindow = null);

    window.once('ready-to-show', () => {
        window.show();
        setWindowReady(true);
    });

    /* webContent events */

    window.webContents.on('devtools-opened', () => {
        window.focus();
        setImmediate(() => window.focus());
    });

    // open external links in the default web browser
    window.webContents.on('will-navigate', (event, url) => {
        // check if the resource is external
        if (isExternalResource(url, window.webContents)) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    window.webContents.setWindowOpenHandler(details => {
        if (isExternalResource(details.url, window.webContents)) {
            shell.openExternal(details.url);
            return {action: 'deny'};
        } else return {action: 'allow'}
    });

    // mixin custom words for spell checking
    customWords.forEach(word => window.webContents.session.addWordToSpellCheckerDictionary(word));

    return window;
}

function handleSecondInstance(_event: Event, argv: string[]) {
    const argvParsed = parseArgv(argv);

    function doOnSecondInstance() {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // do the actual changes
            if (argvParsed.location) {
                const locHash = argvParsed.location;

                import(/* webpackMode: "lazy-once" */ './utils/ipc').then(({UTILITIES}) =>
                    UTILITIES.changeLocationHash(locHash));
            }
        }
    }

    // check for url command in argv
    if ('allow-file-access-from-files' in argvParsed) {
        // there is an url command in form of lclplauncher://...
        const urlCommand = argvParsed['allow-file-access-from-files'];
        executeUrlCommand(argvParsed, urlCommand).then(() => {
            // url command did execute and left its changes (e.g. modifications on argvParsed)
            doOnSecondInstance();
        }).catch(err => console.error('Error executing url command:', err));
    } else {
        doOnSecondInstance();
    }
}
