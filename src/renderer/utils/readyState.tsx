import React from "react";
import ReactDOM from "react-dom";
import type UpdateCheckResult from "../../common/types/UpdateCheckResult";
import type { UpdateCheckingState } from "./ipc";
import Notifier from "./notifier";
import { updaterManager } from "./updater";

export const readyNotifier = new Notifier<void>();
let appShown = false;

function showApp() {
    if (appShown) return;
    appShown = true;
    readyNotifier.unbind();

    import('../components/App').then((App) => {
        ReactDOM.render(<App.default/>, document.getElementById('app'));
    });
}

export async function showWhenReady(pendingResult: Promise<boolean>) {
    readyNotifier.bind(showApp);

    pendingResult.then(ready => {
        if (ready) showApp();
    });
}

export function checkForUpdate(pendingResult: Promise<UpdateCheckingState>): Promise<UpdateCheckResult> {
    return new Promise(async (resolve, reject) => {
        updaterManager.addEventListener('update-state', event => {
            if (!event.detail.state) {
                reject(new Error('State is undefined'));
                return;
            }

            resolve(event.detail.state);
        });

        const checkingResult = await pendingResult;
        if (checkingResult[0] || (checkingResult[1] && checkingResult[1].updateAvailable)) {
            import('../components/UpdateChecking').then((UpdateChecking) => {
                ReactDOM.render(<UpdateChecking.default result={checkingResult[1]} />, document.getElementById('app'));
            });
        }
    });

    // Ipc.UPDATER.isUpdateChecking().then(checkingResult => {
    //     if (checkingResult[0] || (checkingResult[1] && checkingResult[1].updateAvailable)) {
    //         ReactDOM.render(<UpdateChecking result={checkingResult[1]} />, document.getElementById('app'));
    //     } else {
    //         setWindowMaximizable(true);
    //         ReactDOM.render(<App />, document.getElementById('app'));
    //     }
    // }).catch(err => {
    //     log.error('Could not fetch whether currently update-checking:', err);
    //     ReactDOM.render(<UpdateChecking error={err} />, document.getElementById('app'));
    // });
}