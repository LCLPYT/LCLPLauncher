import { SingletonCache } from "../cache/SingletonCache";

const cache = new SingletonCache<LauncherInfo>();

/**
 * Fetches current launcher information, e.g. minimum version etc.
 * @returns A promise for a LauncherInfo object.
 */
export async function fetchLauncherInfo(): Promise<LauncherInfo> {
    const cachedInfo = cache.get();
    if (cachedInfo) return cachedInfo;

    const headers = new Headers();
    headers.append('pragma', 'no-cache');
    headers.append('cache-control', 'no-cache');

    const content = await fetch('https://lclpnet.work/api/lclplauncher/info', {
        headers: headers
    });

    const info = <LauncherInfo> await content.json();
    cache.set(info);

    return info;
}