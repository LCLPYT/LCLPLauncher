import { BrowserWindow } from "electron";
import { autoUpdater, ProgressInfo } from "electron-updater";
import type UpdateCheckResult from "../../common/types/UpdateCheckResult";
import type AppLatestInfo from "../types/AppLatestInfo";
import { getAppVersion, isRunningAsAppImage } from "./env";
import { isWindowReady } from "./window";
import * as semver from 'semver';
import { UPDATER } from "./ipc";
import fetch, { Headers } from "electron-fetch";
import { isDevelopment } from "../../common/utils/env";
import { isPlatform } from "./oshooks";
import * as YAML from 'yaml';
import log from 'electron-log';

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

export async function checkForUpdates(windowSupplier: WindowSupplier) {
    if (isDevelopment) {
        updateCheckResult = {updateAvailable: false};
        return;
    }

    function handleUpdateError(err: any) {
        log.error('Error while updating:', err);
        updateError = err;
        UPDATER.sendUpdateError(err);
    }

    if (isPlatform('linux') && !isRunningAsAppImage()) {
        log.info('Checking for updates manually...');

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
            .catch(handleUpdateError);

        return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.on('update-available', () => onUpdateAvailable(windowSupplier));
    autoUpdater.on('update-not-available', () => onNoUpdateAvailable(windowSupplier));
    autoUpdater.on('error', handleUpdateError);
    autoUpdater.on('checking-for-update', () => log.info('Checking for updates...'));
    autoUpdater.on('download-progress', (progress: ProgressInfo) => UPDATER.sendUpdateProgress(progress));
    autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
    updateChecking = true;
    await autoUpdater.checkForUpdates();
}

function onNoUpdateAvailable(windowSupplier: WindowSupplier) {
    log.info('No update available; already up-to-date.');
    updateCheckResult = {
        updateAvailable: false
    };
    updateChecking = false;
    if (isWindowReady()) sendUpdateAvailability(windowSupplier);
}

function onUpdateAvailable(windowSupplier: WindowSupplier) {
    log.info('Update available. Checking for minimum launcher version...');

    fetchMandatoryUpdateRequired().then(mandatory => {
        updateCheckResult = {
            updateAvailable: true,
            mandatory: mandatory
        };
        updateChecking = false;
        if (isWindowReady()) sendUpdateAvailability(windowSupplier);
    }).catch(err => {
        log.error('Could not fetch launcher info:', err);
        updateCheckResult = { updateAvailable: true };
        updateChecking = false;
        if (isWindowReady()) sendUpdateAvailability(windowSupplier);
    });
}

export function notifyWindowReady(windowSupplier: WindowSupplier) {
    if (updateCheckResult !== undefined) sendUpdateAvailability(windowSupplier);
}

function sendUpdateAvailability(windowSupplier: WindowSupplier) {
    if (!updateCheckResult) return;

    const mainWindow = windowSupplier();
    if (mainWindow) {
        if (updateCheckResult.updateAvailable) {
            mainWindow.setTitle('LCLPLauncher - Update available');
        } else {
            mainWindow.setTitle('LCLPLauncher');
        }
    }

    UPDATER.sendUpdateState(updateCheckResult);
}

async function fetchLauncherInfo() {
    const headers = new Headers();
    headers.append('pragma', 'no-cache');
    headers.append('cache-control', 'no-cache');

    const content = await fetch('https://lclpnet.work/api/lclplauncher/info', {
        headers: headers
    });

    return <LauncherInfo> await content.json();
}

export async function fetchMandatoryUpdateRequired(): Promise<boolean> {
    const info = await fetchLauncherInfo();

    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine current app version.');

    return !semver.gte(currentAppVersion, info.minVersion);
}

export type WindowSupplier = (() => BrowserWindow | null);