import { BrowserWindow } from "electron";

let mainWindow: BrowserWindow | undefined;

export function setMainWindow(window: BrowserWindow) {
    mainWindow = window;
}

export function getMainWindow() {
    return mainWindow;
}