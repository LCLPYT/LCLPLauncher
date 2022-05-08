import { app } from 'electron';
import { isDevelopment } from '../../common/utils/env';

export function getAppVersion(): string | undefined {
    if (isDevelopment) return process.env.npm_package_version;
    else return app.getVersion();
}

export function getAppName(): string | undefined {
    if (isDevelopment) return process.env.npm_package_name;
    else return app.getName();
}

export function isRunningAsAppImage() {
    return !!getAppImagePath();
}

export function getAppImagePath() {
    return process.env['APPIMAGE'];
}