import ElectronLog from "electron-log";
import type UpdateCheckResult from "../../../common/types/UpdateCheckResult";
import { isDevelopment } from "../../../common/utils/env";
import { isRunningAsAppImage } from "../../utils/env";
import { isPlatform } from "../../utils/oshooks";
import { checkElectronUpdaterUpdate } from "./electronUpdater";
import { checkLinuxUpdate as checkForLinuxUpdate } from "./linuxUpdater";
import { isUpdateMandatory } from "./mandatoryUpdater";

/**
 * Checks for launcher updates.
 * Uses Electron-Updater, unless the installation is on linux and without AppImage.
 * In the latter case, update information is gathered manually.
 * @returns A promise of an UpdateCheckResult object.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
    if (isDevelopment) {
        // return {updateAvailable: true, versionName: '2.0.0-dev', mandatory: true};
        return {updateAvailable: false};
    }
    
    // handle linux installations without AppImage (electron-updater is unsupported)
    if (isPlatform('linux') && !isRunningAsAppImage()) {
        ElectronLog.info('Checking for updates manually...');
        const [updateAvailable, latestVersion] = await checkForLinuxUpdate();
        if (!updateAvailable) return {updateAvailable: false};
        
        return fetchUpdateIsMandatory(latestVersion);
    }

    // handle with electron updater
    const [updateAvailable, latestVersion] = await checkElectronUpdaterUpdate();
    if (!updateAvailable) {
        ElectronLog.debug('No update available.');
        return {updateAvailable: false};
    }

    ElectronLog.debug('Update to version', latestVersion, 'is available. Checking whether the update is mandatory...');
    
    return fetchUpdateIsMandatory(latestVersion);
}

async function fetchUpdateIsMandatory(latestVersion: string): Promise<UpdateCheckResult> {
    return {
        updateAvailable: true,
        mandatory: await isUpdateMandatory(),
        versionName: latestVersion
    };
}
