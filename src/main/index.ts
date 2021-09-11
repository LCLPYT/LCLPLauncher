// set NODE_ENV correctly for react-router-dom, so it will work in production...
process.env['NODE_' + 'ENV'] = process.env.NODE_ENV;

import { app, shell, BrowserWindow, nativeTheme, nativeImage } from 'electron'
import * as path from 'path'
import { isDevelopment } from '../common/utils/env';
import * as Database from './database/database';
import * as Ipc from './utils/ipc';
import { isExternalResource } from '../common/utils/urls';
import { customWords } from './utils/dictionary';
import { setMainWindow, setWindowReady } from './utils/window';
import { Settings } from '../common/utils/settings';

import logoData from '../renderer/img/logo.png';
import { checkForUpdates, notifyWindowReady } from './utils/updater';

// auto update
checkForUpdates(() => mainWindow);

// init settings
Settings.init();

// init database in background
Database.initDatabase();

// init IPC
Ipc.initIPC();

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;

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
            contextIsolation: false,
            enableRemoteModule: true
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

    if (isDevelopment) {
        console.log(`Loading content from: http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}...`);
        window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).catch(e => console.error(e));
    } else {
        const indexHTML = path.join(__dirname + '/index.html');
        window.loadFile(indexHTML).catch(e => console.error(e));
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

// create main BrowserWindow when electron is ready
app.on('ready', () => {
    nativeTheme.themeSource = 'dark';
    createMainWindow().then(window => {
        mainWindow = window;
        setMainWindow(mainWindow);
    });
});

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