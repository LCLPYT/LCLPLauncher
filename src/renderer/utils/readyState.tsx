import Notifier from "./notifier";
import ReactDOM from "react-dom";
import React from "react";

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