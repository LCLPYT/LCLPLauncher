import App from "../../common/types/App";
import { getBackendHost } from "../../common/utils/settings";
import Net from "../core/service/net";

export async function fetchApp(appKey: string): Promise<App> {
    const response = await Net.fetch(`${getBackendHost()}/api/lclplauncher/app/${appKey}`);
    return await response.json();
}