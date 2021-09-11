import { BrowserWindow } from "electron";
import UpdateCheckResult from "../../common/types/UpdateCheckResult";

let updateChecking = false;
let updateCheckResult: UpdateCheckResult | undefined;

export function setUpdateChecking(checking: boolean) {
    updateChecking = checking;
}

export function setUpdateCheckResult(result?: UpdateCheckResult) {
    updateCheckResult = result;
}

export function isUpdateChecking() {
    return updateChecking;
}

export function getUpdateCheckResult() {
    return updateCheckResult;
}

export function freeWindow(window: BrowserWindow) {
    window.setResizable(true);
    window.setMaximizable(true);
    window.setFullScreenable(true);
    window.setSize(1000, 750);
    window.setMinimumSize(800, 600);
    window.setTitle('LCLPLauncher');
    window.center();
}