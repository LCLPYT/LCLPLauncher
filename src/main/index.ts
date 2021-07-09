// set NODE_ENV correctly for react-router-dom, so it will work in production...
process.env['NODE_' + 'ENV'] = process.env.NODE_ENV;

import { app, shell, BrowserWindow } from 'electron'
import * as path from 'path'
import { isDevelopment } from '../common/env';
import { isExternalResource } from '../common/urls';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;

/**
 * Creates the main window of the application.
 * @returns The main window.
 */
function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false,
        frame: false,
        backgroundColor: '#24292E',
        width: 1000,
        height: 750,
        minWidth: 800,
        minHeight: 600
    });

    window.removeMenu();

    if (isDevelopment) {
        window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).catch(e => console.error(e));
    } else {
        const indexHTML = path.join(__dirname + '/index.html');
        window.loadFile(indexHTML).catch(e => console.error(e));
    }

    /* window events */

    window.on('closed', () => mainWindow = null);

    window.once('ready-to-show', () => window.show());
    
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

    return window;
}

// create main BrowserWindow when electron is ready
app.on('ready', () => mainWindow = createMainWindow());

// quit application when all windows are closed
app.on('window-all-closed', () => {
    // on macOS it is common for applications to stay open until the user explicitly quits
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    // on macOS it is common to re-create a window even after all windows have been closed
    if (mainWindow === null) mainWindow = createMainWindow();
});