import React from "react";
import ReactDOM from "react-dom";
import Notifier from "../../common/utils/notifier";
import { getUpdateState } from "../event/updater";

export const readyNotifier = new Notifier<void>();
let appShown = false;

function showApp() {
    if (appShown) return;
    appShown = true;
    readyNotifier.unbind();

    const updateState = getUpdateState();
    if (!!updateState?.updateAvailable && !!updateState.mandatory) {
        import('../components/MandatoryUpdate').then((UpdateChecking) => {
            ReactDOM.render(<UpdateChecking.default/>, document.getElementById('app'));
        });
    } else {
        import('../components/App').then((App) => {
            ReactDOM.render(<App.default/>, document.getElementById('app'));
        });
    }
}

export async function showWhenReady(pendingResult: Promise<boolean>) {
    readyNotifier.bind(showApp);

    pendingResult.then(ready => {
        if (ready) showApp();
    });
}