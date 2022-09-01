import ElectronLog from "electron-log";
import { autoUpdater, UpdateInfo } from "electron-updater";

export async function checkElectronUpdaterUpdate(): Promise<[boolean, string]> {
    return new Promise((resolve, reject) => {
        autoUpdater.autoDownload = false;
        autoUpdater.logger = ElectronLog;

        autoUpdater.on('checking-for-update', () => ElectronLog.info('Checking for updates...'))
            .on('update-available', (info: UpdateInfo) => resolve([true, info.version]))
            .on('update-not-available', (info: UpdateInfo) => resolve([false, info.version]))
            .on('error', reject);
            
        autoUpdater.checkForUpdates();
    });
}