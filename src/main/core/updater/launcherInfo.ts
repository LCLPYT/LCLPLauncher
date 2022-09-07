import { SingletonCache } from "../cache/SingletonCache";
import Net from "../service/net";

const cache = new SingletonCache<LauncherInfo>();

/**
 * Fetches current launcher information, e.g. minimum version etc.
 * @returns A promise for a LauncherInfo object.
 */
export async function fetchLauncherInfo(): Promise<LauncherInfo> {
    const cachedInfo = cache.get();
    if (cachedInfo) return cachedInfo;

    const content = await Net.fetchUncached('https://lclpnet.work/api/lclplauncher/info');

    const info = <LauncherInfo> await content.json();
    cache.set(info);

    return info;
}