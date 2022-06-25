import 'bootstrap'; // bootstrap js
import log from 'electron-log';
import path from 'path';
import {isDevelopment} from '../common/utils/env';
import './style/app.scss'; // general application style
import './style/material-icons/material-icons.css'; // material-icons
import {registerKeybinds} from './utils/keybinds';
import {initI18n} from "./utils/i18n";
import {renderCustomTitleBar} from "./page";
import {showWhenReady} from "./utils/readyState";

// accept code hot updates in development
if (module.hot) {
    module.hot.accept();
}

// configure logger
log.transports.console.level = 'info';
log.transports.file.level = 'debug';

renderCustomTitleBar();

registerKeybinds();

(async () => {
    const Ipc = await import('./utils/ipc');
    Ipc.initIPC();

    window.onbeforeunload = () => {
        /* If window is reloaded, remove win event listeners
        (DOM element listeners get auto garbage collected but not
            Electron window listeners as the win is not de-referenced unless closed) */
        Ipc.UTILITIES.removeAllListeners();
    };

    // register service worker for cache
    if ('serviceWorker' in navigator) {
        const appPath = await Ipc.UTILITIES.getAppPath();
        registerSw(appPath);
    }

    await initI18n().catch(err => log.error('Error loading translations', err));

    await showWhenReady(Ipc.UTILITIES.requestAppReadyState());
})();

function registerSw(appPath: string) {
    window.addEventListener('load', () => {
        const workerPath = isDevelopment ? '/service-worker.js' : path.resolve(appPath, 'service-worker.js');
        log.info('Registering service worker:', workerPath);

        navigator.serviceWorker.register(workerPath)
            .then(registration => log.info('ServiceWorker registration successful with scope:', registration.scope))
            .catch(error => log.error('ServiceWorker registration failed:', error));
    });
}

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
//
// updaterManager.addEventListener('update-state', event => {
//     if (!event.detail.state) throw new Error('State is undefined');
//     if (!event.detail.state.updateAvailable) ReactDOM.render(<App />, document.getElementById('app'));
// });