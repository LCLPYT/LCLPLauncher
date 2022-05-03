import React from 'react';
import ReactDOM from 'react-dom';
import { registerKeybinds } from './utils/keybinds';
import App from './components/App';
import Titlebar from './components/Titlebar';
import { isDevelopment } from '../common/utils/env';
import path from 'path';
import * as Ipc from './utils/ipc';

import 'bootstrap'; // bootstrap js
import './style/material-icons/material-icons.css'; // material-icons
import './style/app.scss'; // general application style
import './img/logo.png';
import UpdateChecking from './components/UpdateChecking';
import { updaterManager } from './utils/updater';
import { setWindowMaximizable } from './utils/windowEvents';
import log from 'electron-log';

// configure logger
log.transports.console.level = 'info';
log.transports.file.level = 'debug';

// init IPC
Ipc.initIPC();

/* Add keybinds */
registerKeybinds();

window.onbeforeunload = () => {
    /* If window is reloaded, remove win event listeners
    (DOM element listeners get auto garbage collected but not
        Electron win listeners as the win is not dereferenced unless closed) */
    Ipc.UTILITIES.removeAllListeners();
};

// register service worker for cache
if ('serviceWorker' in navigator) {
    Ipc.UTILITIES.getAppPath().then(appPath => {
        window.addEventListener('load', () => {
            const workerPath = isDevelopment ? '/service-worker.js' : path.resolve(appPath, 'service-worker.js');
            log.info('Registring service worker:', workerPath);
            navigator.serviceWorker.register(workerPath)
                .then(registration => log.info('ServiceWorker registration successful with scope:', registration.scope),
                    error => log.error('ServiceWorker registration failed:', error)
                );
        });
    })
}

/* Create custom toolbar */
const toolbarDiv: HTMLDivElement = document.createElement('div');
toolbarDiv.id = 'titlebar';
document.body.insertBefore(toolbarDiv, document.body.firstChild);

/* Render react components */
ReactDOM.render(<Titlebar maximizable={false} />, toolbarDiv);

Ipc.UPDATER.isUpdateChecking().then(checkingResult => {
    if (checkingResult[0] || (checkingResult[1] && checkingResult[1].updateAvailable)) {
        ReactDOM.render(<UpdateChecking result={checkingResult[1]} />, document.getElementById('app'));
    } else {
        setWindowMaximizable(true);
        ReactDOM.render(<App />, document.getElementById('app'));
    }
}).catch(err => {
    log.error('Could not fetch whether currently update-checking:', err);
    ReactDOM.render(<UpdateChecking error={err} />, document.getElementById('app'));
});

updaterManager.addEventListener('update-state', event => {
    if (!event.detail.state) throw new Error('State is undefined');
    if (!event.detail.state.updateAvailable) ReactDOM.render(<App />, document.getElementById('app'));
});