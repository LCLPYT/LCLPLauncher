import semver from "semver";
import * as YAML from 'yaml';
import type AppLatestInfo from "../../types/AppLatestInfo";
import { getAppVersion } from "../../utils/env";
import Net from "../service/net";

/**
 * Checks for linux updates of the launcher manually.
 * @returns Tuple with update availability and latest version name.
 */
export async function checkLinuxUpdate(): Promise<[boolean, string]> {
    const info = await Net.fetchUncached('https://lclpnet.work/lclplauncher/files/latest-linux.yml')
        .then(resp => resp.text())
        .then(content => <AppLatestInfo> YAML.parse(content));

    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine current app version.');

    return [semver.lt(currentAppVersion, info.version), info.version];
}