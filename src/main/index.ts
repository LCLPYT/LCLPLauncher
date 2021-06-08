'use strict'

import { app, BrowserWindow } from 'electron'
import * as path from 'path'

export const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;

function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false,
        frame: false
    });

    window.removeMenu();

    if (isDevelopment) {
        window.webContents.openDevTools();
        window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`).catch(e => console.error(e));
    } else {
        const indexHTML = path.join(__dirname + '/index.html');
        window.loadFile(indexHTML).catch(e => console.error(e));
    }
    
    window.on('closed', () => mainWindow = null);
    
    window.webContents.on('devtools-opened', () => {
        window.focus();
        setImmediate(() => window.focus());
    });

    window.once('ready-to-show', () => window.show());
    
    return window;
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
    // on macOS it is common for applications to stay open until the user explicitly quits
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    // on macOS it is common to re-create a window even after all windows have been closed
    if (mainWindow === null) mainWindow = createMainWindow();
});

// create main BrowserWindow when electron is ready
app.on('ready', () => mainWindow = createMainWindow());