// set NODE_ENV correctly for react-router-dom, so it will work in production...
process.env['NODE_' + 'ENV'] = process.env.NODE_ENV;

import { app, shell, BrowserWindow, nativeTheme, nativeImage } from 'electron'
import { isDevelopment } from '../common/utils/env';
import * as Database from './database/database';
import * as Ipc from './utils/ipc';
import * as path from 'path';
import { isExternalResource } from '../common/utils/urls';
import { customWords } from './utils/dictionary';
import { setMainWindow, setWindowReady } from './utils/window';
import { Settings } from '../common/utils/settings';
import { checkForUpdates, notifyWindowReady } from './utils/updater';
import { executeUrlCommand, getParsedArgv, handleArgv, parseArgv } from './utils/argv';
import log from 'electron-log';

import logoData from '../renderer/img/logo.png';
import { getAppName } from './utils/env';

// set app name manually, if in development environment
if (isDevelopment) {
    app.setName(`${getAppName()}-dev`);
}

// configure logger
log.transports.console.level = 'info';
log.transports.file.level = 'verbose';
log.catchErrors({
    showDialog: false
});

// Handle programm arguments
handleArgv().then(exitCode => {
    if (exitCode === undefined) startGUI();
    else process.exit(exitCode);
}).catch(err => {
    console.error('Error while handling program args:', err);
    process.exit(1);
});

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;
let appWasReady = false;

function startGUI() {
    const lock = app.requestSingleInstanceLock();
    if (!lock) {
        app.quit();
        return;
    } else {
        app.on('second-instance', (_event, argv) => {
            const argvParsed = parseArgv(argv);

            function doOnSecondInstance() {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
    
                    // do actual changes
                    if (argvParsed.location) Ipc.UTILITIES.changeLocationHash(argvParsed.location);
                }
            }

            // check for url command in argv
            if ('allow-file-access-from-files' in argvParsed) {
                // there is a url command in form of lclplauncher://...
                const urlCommand = argvParsed['allow-file-access-from-files'];
                executeUrlCommand(argvParsed, urlCommand).then(() => {
                    // url command did execute and left it's changes (e.g. modifications on argvParsed)
                    doOnSecondInstance();
                }).catch(err => console.error('Error executing url command:', err));
            } else doOnSecondInstance();
        });
    }

    if (process.defaultApp) {
        if (process.argv.length >= 2) app.setAsDefaultProtocolClient('lclplauncher', process.execPath, [path.resolve(process.argv[1])]);
    } else {
        app.setAsDefaultProtocolClient('lclplauncher');
    }

    // auto update
    checkForUpdates(() => mainWindow);

    // init settings
    Settings.init();

    // init database in background
    Database.initDatabase();

    // init IPC
    Ipc.initIPC();

    if (appWasReady) startAppGUI();

    // create main BrowserWindow when electron is ready
    app.on('ready', () => startAppGUI());

    // quit application when all windows are closed
    app.on('window-all-closed', () => {
        // on macOS it is common for applications to stay open until the user explicitly quits
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        // on macOS it is common to re-create a window even after all windows have been closed
        if (mainWindow === null) {
            createMainWindow().then(window => {
                mainWindow = window;
                setMainWindow(mainWindow);
            });
        }
    });
}

let appGuiStarted = false;

function startAppGUI() {
    if (appGuiStarted) return;
    appGuiStarted = true;

    nativeTheme.themeSource = 'dark';
    createMainWindow().then(window => {
        mainWindow = window;
        setMainWindow(mainWindow);
    });
}

/**
 * Creates the main window of the application.
 * @returns The main window.
 */
async function createMainWindow(): Promise<BrowserWindow> {
    let icon: nativeImage | undefined;
    if (isDevelopment) icon = nativeImage.createFromDataURL(logoData);

    const window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        show: false,
        frame: false,
        backgroundColor: '#24292E',
        width: 440,
        height: 110,
        title: 'LCLPLauncher - Loading',
        icon: icon,
        resizable: false,
        maximizable: false,
        fullscreenable: false
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
        }).catch(e => console.error(e));
    }

    /* window events */

    window.on('closed', () => mainWindow = null);

    window.once('ready-to-show', () => {
        window.show();
        setWindowReady(true);
        notifyWindowReady(() => mainWindow);
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
            return { action: 'deny' };
        } else return { action: 'allow' }
    });

    // mixin custom words for spell checking
    customWords.forEach(word => window.webContents.session.addWordToSpellCheckerDictionary(word));

    return window;
}

app.on('ready', () => appWasReady = true);