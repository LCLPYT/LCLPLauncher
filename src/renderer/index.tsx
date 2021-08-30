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

// Add content security policy tag when in production
if (!isDevelopment) {
    const contentPolicyMeta: HTMLMetaElement = document.createElement('meta');
    contentPolicyMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    contentPolicyMeta.setAttribute('content', "script-src 'self';");
    document.head.appendChild(contentPolicyMeta);
}

// init IPC
Ipc.initIPC();

/* Add keybinds */
registerKeybinds();

/* Create custom toolbar */

const toolbarDiv: HTMLDivElement = document.createElement('div');
toolbarDiv.id = 'titlebar';
document.body.insertBefore(toolbarDiv, document.body.firstChild);

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

function handleWindowControls() {
    // Make minimise/maximise/restore/close buttons work when they are clicked
    const minButton = document.getElementById('min-button');
    const maxButton = document.getElementById('max-button');
    const restoreButton = document.getElementById('restore-button');
    const closeButton = document.getElementById('close-button');

    if (minButton != null) minButton.addEventListener("click", () => win.minimize());
    if (maxButton != null) maxButton.addEventListener("click", () => win.maximize());
    if (restoreButton != null) restoreButton.addEventListener("click", () => win.unmaximize());
    if (closeButton != null) closeButton.addEventListener("click", () => win.close());

    // Toggle maximise/restore buttons when maximisation/unmaximisation occurs
    toggleMaxRestoreButtons();
    win.on('resize', toggleMaxRestoreButtons);

    function toggleMaxRestoreButtons() {
        if (win.isMaximized()) {
            document.body.classList.add('maximized');
        } else {
            document.body.classList.remove('maximized');
        }
    }
}

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

/* Render react components */

ReactDOM.render(<Titlebar />, toolbarDiv);
ReactDOM.render(<App />, document.getElementById('app'));