import React, { Component } from 'react';
import logo from '../img/logo.svg';
import { UTILITIES } from '../utils/ipc';
import { WindowEvent, windowManager } from '../event/windowEvents';

interface Props {
    maximizable?: boolean
}

interface State {
    maximizeButton: boolean
}

class Titlebar extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            maximizeButton: this.props.maximizable !== undefined ? this.props.maximizable : false
        };
    }

    render() {
        return (
            <div className="dragarea" id="drag-region">
                <div id="window-title">
                    <img src={logo} alt="Logo" />
                    <span>LCLPLauncher</span>
                    {/* Cannot use I18n here yet, because it may not be initialized */}
                </div>
                <div id="window-controls">
                    {
                        this.state.maximizeButton ? (
                            <div className="button" id="max-button">
                                <svg width="10" height="10" viewBox="0 0 10 10">
                                    <path d="m10-1.6667e-6v10h-10v-10zm-1.001 1.001h-7.998v7.998h7.998z" strokeWidth=".25" />
                                </svg>
                            </div>
                        ) : undefined
                    }
                    <div className={`button${!this.state.maximizeButton ? ' offset' : ''}`} id="min-button">
                        <svg width="11" height="1" viewBox="0 0 11 1">
                            <path d="m11 0v1h-11v-1z" strokeWidth=".26208" />
                        </svg>
                    </div>
                    <div className="button" id="restore-button">
                        <svg width="11" height="11" viewBox="0 0 11 11">
                            <path
                                d="m11 8.7978h-2.2021v2.2022h-8.7979v-8.7978h2.2021v-2.2022h8.7979zm-3.2979-5.5h-6.6012v6.6011h6.6012zm2.1968-2.1968h-6.6012v1.1011h5.5v5.5h1.1011z"
                                strokeWidth=".275" />
                        </svg>
                    </div>
                    <div className="button" id="close-button">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path
                                d="m6.8496 6 5.1504 5.1504-0.84961 0.84961-5.1504-5.1504-5.1504 5.1504-0.84961-0.84961 5.1504-5.1504-5.1504-5.1504 0.84961-0.84961 5.1504 5.1504 5.1504-5.1504 0.84961 0.84961z"
                                strokeWidth=".3" />
                        </svg>
                    </div>
                </div>
            </div>
        );
    }

    protected windowListeners: {
        [type: string]: (event: WindowEvent) => void
    } = {};

    componentDidMount() {
        windowManager.addEventListener('maximizable-change', this.windowListeners['maximizable-change'] = event => {
            if (event.detail.maximizable === undefined) throw new Error('Maximizable is undefined');
            this.setState({ maximizeButton: event.detail.maximizable })
        });

        // Make minimise/maximise/restore/close buttons work when they are clicked
        const minButton = document.getElementById('min-button');
        const restoreButton = document.getElementById('restore-button');
        const closeButton = document.getElementById('close-button');

        minButton?.addEventListener('click', () => UTILITIES.minimizeWindow());
        restoreButton?.addEventListener('click', () => UTILITIES.unMaximizeWindow());
        closeButton?.addEventListener('click', () => UTILITIES.closeWindow());

        // Toggle maximise/restore buttons when maximisation/unmaximisation occurs
        toggleMaxRestoreButtons();
        window.addEventListener('resize', () => toggleMaxRestoreButtons());

        function toggleMaxRestoreButtons() {
            UTILITIES.isWindowMaximized().then(maximized => {
                if (maximized === null) return;
                else if (maximized) document.body.classList.add('maximized');
                else document.body.classList.remove('maximized');
            });
        }

        this.update();
    }

    componentDidUpdate() {
        this.update();
    }

    componentWillUnmount() {
        Object.entries(this.windowListeners).forEach(([type, listener]) => {
            windowManager.removeEventListener(type, listener);
        });
    }

    protected oldMaxButton?: HTMLElement;
    protected maxListener?: () => void;

    update() {
        const maxButton = document.getElementById('max-button');
        if (maxButton) {
            if (this.maxListener && this.oldMaxButton) this.oldMaxButton.removeEventListener('click', this.maxListener);
            this.oldMaxButton = maxButton;
            maxButton.addEventListener('click', this.maxListener = () => UTILITIES.maximizeWindow());
        }
    }
}

export default Titlebar;