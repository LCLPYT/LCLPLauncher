import { BrowserWindow } from "electron";
import { autoUpdater, ProgressInfo } from "electron-updater";
import UpdateCheckResult from "../../common/types/UpdateCheckResult";
import { getAppVersion, isRunningAsAppImage } from "./env";
import { isWindowReady } from "./window";
import * as semver from 'semver';
import { UPDATER, UTILITIES } from "./ipc";
import fetch, { Headers } from "electron-fetch";
import { isDevelopment } from "../../common/utils/env";
import { isPlatform } from "./oshooks";
import * as YAML from 'yaml';
import AppLatestInfo from "../types/AppLatestInfo";

let updateChecking = false;
let updateCheckResult: UpdateCheckResult | undefined;
let updateError: any;

export function isUpdateChecking() {
    return updateChecking;
}

export function getUpdateCheckResult() {
    return updateCheckResult;
}

export function getUpdateError() {
    return updateError;
}

export function freeWindow(window: BrowserWindow) {
    window.setResizable(true);
    window.setMaximizable(true);
    window.setFullScreenable(true);
    window.setSize(1000, 750);
    window.setMinimumSize(800, 600);
    window.setTitle('LCLPLauncher');
    window.center();

    UTILITIES.setMaximizable(true);
}

export function checkForUpdates(windowSupplier: () => BrowserWindow | null) {
    if (!isDevelopment) {
        if (isPlatform('linux') && !isRunningAsAppImage()) {
            console.log('Checking for updates manually...');

            updateChecking = true;

            const headers = new Headers();
            headers.append('pragma', 'no-cache');
            headers.append('cache-control', 'no-cache');

            fetch('https://lclpnet.work/lclplauncher/files/latest-linux.yml', {
                headers: headers
            }).then(resp => resp.text())
                .then(content => <AppLatestInfo>YAML.parse(content))
                .then(info => {
                    const currentAppVersion = getAppVersion();
                    if (!currentAppVersion) throw new Error('Could not determine current app version.');
                    (semver.gte(currentAppVersion, info.version) ? onNoUpdateAvailable : onUpdateAvailable)(windowSupplier);
                })
                .catch(err => {
                    console.error('Error while updating:', err);
                    updateError = err;
                    const mainWindow = windowSupplier();
                    if (mainWindow) {
                        mainWindow.setSize(440, 180);
                        mainWindow.setResizable(true);
                        mainWindow.center();
                    }
                    UPDATER.sendUpdateError(err);
                });
            return;
        }

        autoUpdater.autoDownload = false;
        autoUpdater.on('update-available', () => onUpdateAvailable(windowSupplier));
        autoUpdater.on('update-not-available', () => onNoUpdateAvailable(windowSupplier));
        autoUpdater.on('error', err => {
            console.error('Error while updating:', err);
            updateError = err;
            const mainWindow = windowSupplier();
            if (mainWindow) {
                mainWindow.setSize(440, 180);
                mainWindow.setResizable(true);
                mainWindow.center();
            }
            UPDATER.sendUpdateError(err);
        });
        autoUpdater.on('checking-for-update', () => console.log('Checking for updates...'));
        autoUpdater.on('download-progress', (progress: ProgressInfo) => UPDATER.sendUpdateProgress(progress));
        autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
        updateChecking = true;
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
        updateCheckResult = { updateAvailable: false };
    }
}

function onNoUpdateAvailable(windowSupplier: () => BrowserWindow | null) {
    console.log('No update available; already up-to-date.');
    updateCheckResult = {
        updateAvailable: false
    };
    updateChecking = false;
    if (isWindowReady()) sendUpdateAvailability(windowSupplier);
}

function onUpdateAvailable(windowSupplier: () => BrowserWindow | null) {
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
                updateCheckResult = { updateAvailable: true };
                updateChecking = false;
                if (isWindowReady()) sendUpdateAvailability(windowSupplier);
                return;
            }

            updateCheckResult = {
                updateAvailable: true,
                mandatory: !semver.gte(currentAppVersion, info.minVersion)
            };
            updateChecking = false;
            if (isWindowReady()) sendUpdateAvailability(windowSupplier);
        })
        .catch(err => {
            console.error('Could not fetch launcher info:', err);
            updateCheckResult = { updateAvailable: true };
            updateChecking = false;
            if (isWindowReady()) sendUpdateAvailability(windowSupplier);
        })
}

export function notifyWindowReady(windowSupplier: () => BrowserWindow | null) {
    if (updateCheckResult !== undefined) sendUpdateAvailability(windowSupplier);
}

function sendUpdateAvailability(windowSupplier: () => BrowserWindow | null) {
    if (!updateCheckResult) return;

    const mainWindow = windowSupplier();
    if (mainWindow) {
        if (updateCheckResult.updateAvailable) {
            mainWindow.setTitle('LCLPLauncher - Update available');
            mainWindow.setSize(440, 155);
            mainWindow.center();
        } else freeWindow(mainWindow);
    }

    UPDATER.sendUpdateState(updateCheckResult);
}