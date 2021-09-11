// set NODE_ENV correctly for react-router-dom, so it will work in production...
process.env['NODE_' + 'ENV'] = process.env.NODE_ENV;

import { app, shell, BrowserWindow, nativeTheme, nativeImage } from 'electron'
import * as path from 'path'
import { getAppVersion, isDevelopment } from '../common/utils/env';
import * as Database from './database/database';
import * as Ipc from './utils/ipc';
import { isExternalResource } from '../common/utils/urls';
import { customWords } from './utils/dictionary';
import { setMainWindow } from './utils/window';
import { Settings } from '../common/utils/settings';

import logoData from '../renderer/img/logo.png';
import { autoUpdater, ProgressInfo } from 'electron-updater';
import { freeWindow, setUpdateChecking, setUpdateCheckResult } from './utils/updater';
import UpdateCheckResult from '../common/types/UpdateCheckResult';
import * as semver from 'semver';
import fetch, { Headers } from 'electron-fetch';

// auto update
let updateState: UpdateCheckResult | undefined;
if (!isDevelopment) {
    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', () => {
        console.log('Update available. Checking for minimum launcher version...');

        const headers = new Headers();
        headers.append('pragma', 'no-cache');
        headers.append('cache-control', 'no-cache');

        fetch('https://lclpnet.work/api/lclplauncher/info', {
            headers: headers
        }).then(resp => resp.json())
            .then(resp => {
                const info = <LauncherInfo>resp;
                console.log('Minimum launcher version fetched: ', info.minVersion);

                const currentAppVersion = getAppVersion();
                if (!currentAppVersion) {
                    console.error('Could not determine app version.');
                    updateState = { updateAvailable: true };
                    setUpdateCheckResult(updateState);
                    setUpdateChecking(false);
                    if (windowReady) sendUpdateAvailability();
                    return;
                }

                updateState = {
                    updateAvailable: true,
                    mandatory: !semver.gte(currentAppVersion, info.minVersion)
                };
                setUpdateChecking(false);
                setUpdateCheckResult(updateState);
                if (windowReady) sendUpdateAvailability();
            })
            .catch(err => {
                console.error('Could not fetch launcher info:', err);
                updateState = { updateAvailable: true };
                setUpdateChecking(false);
                setUpdateCheckResult(updateState);
                if (windowReady) sendUpdateAvailability();
            })
    });
    autoUpdater.on('update-not-available', () => {
        console.log('No update available; already up-to-date.');
        updateState = {
            updateAvailable: false,
            mandatory: true
        };
        setUpdateChecking(false);
        setUpdateCheckResult(updateState);
        if (windowReady) sendUpdateAvailability();
    });
    autoUpdater.on('error', err => {
        console.error('Error while updating:', err);
        if (mainWindow) {
            mainWindow.setSize(440, 180);
            mainWindow.center();
        }
        Ipc.UPDATER.sendUpdateError(err);
    });
    autoUpdater.on('checking-for-update', () => console.log('Checking for updates...'));
    autoUpdater.on('download-progress', (progress: ProgressInfo) => Ipc.UPDATER.sendUpdateProgress(progress));
    autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
    setUpdateChecking(true);
    autoUpdater.checkForUpdates();
} else {
    /*setUpdateChecking(true);
    setTimeout(() => {
        /*if (mainWindow) {
            mainWindow.setSize(440, 180);
            mainWindow.center();
        }
        Ipc.UPDATER.sendUpdateError(new Error('Controlled error'));*/
    /*updateState = {
        updateAvailable: true,
        mandatory: true
    };
    setUpdateChecking(false);
    setUpdateCheckResult(updateState);
    if (windowReady) sendUpdateAvailability();
}, 5000)*/
    updateState = {
        updateAvailable: false
    };
    setUpdateCheckResult(updateState);
}

// init settings
Settings.init();

// init database in background
Database.initDatabase();

// init IPC
Ipc.initIPC();

// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow: BrowserWindow | null;
let windowReady = false;

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
        windowReady = true;
        if (updateState !== undefined) sendUpdateAvailability();
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

function sendUpdateAvailability() {
    if (!updateState) return;

    if (mainWindow) {
        if (updateState.updateAvailable) {
            mainWindow.setTitle('LCLPLauncher - Update available');
            mainWindow.setSize(440, 155);
            mainWindow.center();
        } else freeWindow(mainWindow);
    }

    Ipc.UPDATER.sendUpdateState(updateState);
}