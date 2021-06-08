import React from 'react';
import ReactDOM from 'react-dom';
import App from './components/App';
import Titlebar from './components/Titlebar';
import { remote } from 'electron';

export const isDevelopment = process.env.NODE_ENV !== 'production';

// Add content security policy tag when in production
if (!isDevelopment) {
    const contentPolicyMeta: HTMLMetaElement = document.createElement('meta');
    contentPolicyMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    contentPolicyMeta.setAttribute('content', "script-src 'self';");
    document.head.appendChild(contentPolicyMeta);
}

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
    win.on('maximize', toggleMaxRestoreButtons);
    win.on('unmaximize', toggleMaxRestoreButtons);

    function toggleMaxRestoreButtons() {
        if (win.isMaximized()) {
            document.body.classList.add('maximized');
        } else {
            document.body.classList.remove('maximized');
        }
    }
}

/* Render react components */

ReactDOM.render(<Titlebar />, toolbarDiv);
ReactDOM.render(<App />, document.getElementById('app'));