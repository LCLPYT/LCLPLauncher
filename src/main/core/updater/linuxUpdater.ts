import semver from "semver";
import type AppLatestInfo from "../../types/AppLatestInfo";
import * as YAML from 'yaml';
import { getAppVersion } from "../../utils/env";

/**
 * Checks for linux updates of the launcher manually.
 * @returns Tuple with update availability and latest version name.
 */
export async function checkLinuxUpdate(): Promise<[boolean, string]> {
    const headers = new Headers();
    headers.append('pragma', 'no-cache');
    headers.append('cache-control', 'no-cache');
    
    const info = await fetch('https://lclpnet.work/lclplauncher/files/latest-linux.yml', {
        headers: headers
    }).then(resp => resp.text())
        .then(content => <AppLatestInfo> YAML.parse(content));

    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine current app version.');

    return [semver.lt(currentAppVersion, info.version), info.version];
}