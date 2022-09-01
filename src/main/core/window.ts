import { BrowserWindow } from "electron";

let mainWindow: BrowserWindow | undefined;
let windowReady = false;

export function setMainWindow(window: BrowserWindow) {
    mainWindow = window;
}

export function getMainWindow() {
    return mainWindow;
}

export function setWindowReady(ready: boolean) {
    windowReady = ready;
}

export function isWindowReady() {
    return windowReady;
}