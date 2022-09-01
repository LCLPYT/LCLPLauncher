import semver from "semver";
import { getAppVersion } from "../../utils/env";
import { fetchLauncherInfo } from "./launcherInfo";

export async function isUpdateMandatory(): Promise<boolean> {
    const info = await fetchLauncherInfo();

    const currentAppVersion = getAppVersion();
    if (!currentAppVersion) throw new Error('Could not determine current app version.');

    return semver.lt(currentAppVersion, info.minVersion);
}