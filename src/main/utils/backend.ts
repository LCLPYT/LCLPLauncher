import fetch from "electron-fetch";
import App from "../../common/types/App";
import { getBackendHost } from "../../common/utils/settings";

export async function fetchApp(appKey: string): Promise<App> {
    const response = await fetch(`${getBackendHost()}/api/lclplauncher/app/${appKey}`);
    return await response.json();
}