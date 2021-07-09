import { app, remote } from 'electron';

export const isDevelopment = process.env.NODE_ENV !== 'production';

export function getAppVersion(): string | undefined {
    if (isDevelopment) {
        return process.env.npm_package_version;
    } else {
        try {
            if (app) return app.getVersion();
            else return remote.app.getVersion();
        } catch(error: any) {
            return undefined;
        }
    }
}