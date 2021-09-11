import { WebContents } from "electron";
import { isDevelopment } from "./env";

export function isExternalResource(url: string, webContents: WebContents): boolean {
    const current = webContents.getURL();
    if (isDevelopment) {
        const currentUrl = new URL(current);
        const targetUrl = new URL(url);

        // check if webpack dev server is requested (the same server as the one that was requested originally)
        if(targetUrl.hostname === 'localhost' && currentUrl.port === targetUrl.port) return false; // is an internal resource
    } else {
        // check for the path in the file system; url will be something like: file:///.../app.asar/...
        const pathSegments = current.split('/');
        const asarIndex = pathSegments.indexOf('app.asar');

        if(asarIndex >= 0) {
            if(asarIndex < pathSegments.length - 1) {
                pathSegments.splice(asarIndex + 1, pathSegments.length - asarIndex); // remove every path segment after 'app.asar'
            }

            // rebuild the the trimmed prefix
            const prefix = pathSegments.join('/');
            if(url.startsWith(prefix)) return false; // is an internal resource
        }
    }

    return true;
}