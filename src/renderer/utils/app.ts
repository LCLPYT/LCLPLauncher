import { remote } from 'electron';

export function getAppVersion() {
    return process.env.npm_package_version;
}

export function closeCurrentWindow() {
    remote.getCurrentWindow().close();
}