import React from 'react';
import ReactDOM from 'react-dom';
import { remote } from 'electron';
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

// init IPC
Ipc.initIPC();

/* Add keybinds */
registerKeybinds();

const win = remote.getCurrentWindow();

document.onreadystatechange = () => {
    if (document.readyState === 'complete') handleWindowControls();
};

window.onbeforeunload = () => {
    /* If window is reloaded, remove win event listeners
    (DOM element listeners get auto garbage collected but not
        Electron win listeners as the win is not dereferenced unless closed) */
    win.removeAllListeners();
};

// register service worker for cache
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const workerPath = isDevelopment ? '/service-worker.js' : path.resolve(remote.app.getAppPath(), 'service-worker.js');
        console.log('Registring service worker:', workerPath);
        navigator.serviceWorker.register(workerPath)
            .then(registration => console.log('ServiceWorker registration successful with scope:', registration.scope),
                error => console.error('ServiceWorker registration failed:', error)
            );
    });
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
    } else ReactDOM.render(<App />, document.getElementById('app'));
}).catch(err => {
    console.error('Could not fetch whether currently update-checking:', err);
    ReactDOM.render(<UpdateChecking error={err} />, document.getElementById('app'));
});

updaterManager.addEventListener('update-state', event => {
    if (!event.detail.state) throw new Error('State is undefined');
    if (!event.detail.state.updateAvailable) ReactDOM.render(<App />, document.getElementById('app'));
});

function handleWindowControls() {
    // Make minimise/maximise/restore/close buttons work when they are clicked
    const minButton = document.getElementById('min-button');
    const maxButton = document.getElementById('max-button');
    const restoreButton = document.getElementById('restore-button');
    const closeButton = document.getElementById('close-button');

    minButton?.addEventListener('click', () => win.minimize());
    maxButton?.addEventListener('click', () => win.maximize());
    restoreButton?.addEventListener('click', () => win.unmaximize());
    closeButton?.addEventListener('click', () => win.close());

    // Toggle maximise/restore buttons when maximisation/unmaximisation occurs
    toggleMaxRestoreButtons();
    win.on('resize', toggleMaxRestoreButtons);

    function toggleMaxRestoreButtons() {
        if (win.isMaximized()) document.body.classList.add('maximized');
        else document.body.classList.remove('maximized');
    }
}