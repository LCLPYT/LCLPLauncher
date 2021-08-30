import { Toast } from 'bootstrap';
import React, { Component } from 'react';
import { HashRouter, Redirect, Route, Switch } from 'react-router-dom';
import { ToastEvent, toastManager } from '../utils/toasts';
import Menubar from './Menubar';
import Home from './pages/Home';
import Library from './pages/Library';
import Settings from './pages/Settings';
import ToastOptions, { ToastType } from '../../common/types/Toast';

import toastSound from '../sound/toast.ogg';
import { installationProgressManager, InstallerEvent } from '../utils/downloads';
import DownloadProgress from '../../common/types/DownloadProgress';

class App extends Component {
    render() {
        return (
            <HashRouter>
                <Menubar />
                <div id="pageContent" className="custom-scrollbar">
                    <Switch>
                        <Route exact path="/" render={() => (<Redirect to="/home" />)} />
                        <Route exact path="/home" component={Home} />
                        <Route path="/library" component={Library} />
                        <Route exact path="/settings" component={Settings} />
                    </Switch>
                </div>
                <ToastStack />
            </HashRouter >
        );
    }
}

type ToastMemory = {
    toast: ToastOptions,
    alreadyShown?: boolean,
    createdAt: number
}

interface ToastState {
    toasts: ToastMemory[]
}

class ToastStack extends Component<{}, ToastState> {
    constructor(props: {}) {
        super(props);
        this.state = {
            toasts: []
        };
    }

    render() {
        return (
            <div className="toast-container" id="toastContainer">
                {this.state.toasts.map((toast, index) => this.getToastComponent(toast, index))}
            </div>
        );
    }

    protected toastListeners: {
        [type: string]: (event: ToastEvent) => void
    } = {};

    componentDidMount() {
        toastManager.addEventListener('add-toast', this.toastListeners['add-toast'] = (event: ToastEvent) => {
            if (!event.detail.toast) throw new Error('Add toast: Toast is null');

            this.setState({
                toasts: [...this.state.toasts, {
                    toast: event.detail.toast,
                    createdAt: new Date().getTime()
                }]
            });

            new Audio(toastSound).play();
        });

        toastManager.addEventListener('remove-toast', this.toastListeners['remove-toast'] = (event: ToastEvent) => {
            const toastElement = document.getElementById(`toast${event.detail.toastId}`);

            let hidden = false;
            if (toastElement) {
                const instance = Toast.getInstance(toastElement);
                if (instance) {
                    instance.hide();
                    hidden = true;
                }
            }

            // force hide (without a transition)
            if (!hidden) this.setState({
                toasts: this.state.toasts.filter(memory => memory.toast.id !== event.detail.toastId)
            });
        });

        this.showToasts();
    }

    componentDidUpdate() {
        this.showToasts();
    }

    showToasts() {
        const toastElements = document.querySelectorAll('.toast');
        Array.from(toastElements).forEach(element => {
            let instance = Toast.getInstance(element);
            if (!instance) (instance = new Toast(element)).show();
        });
    }

    componentWillUnmount() {
        Object.entries(this.toastListeners).forEach(([type, listener]) => {
            toastManager.removeEventListener(type, listener)
        });
    }

    getToastComponent(memory: ToastMemory, key: React.Key): JSX.Element {
        const onDestroy = () => this.setState({
            toasts: this.state.toasts.filter(toast => toast !== memory)
        });

        switch (memory.toast.type) {
            case ToastType.DOWNLOAD_STATUS: return <DownloadToast key={key} memory={memory} onDestroy={() => onDestroy()} />
            default:
                throw new Error(`Unimplemented toast type: '${memory.toast.type}'`);
        }
    }
}

interface ToastProps {
    memory: ToastMemory,
    onDestroy: () => void
}

abstract class AbstractToastComponent<State = {}> extends Component<ToastProps, State> {
    protected static timerUpdateInterval = 7000;
    protected lastTimeStep = 0;

    render() {
        const age = new Date().getTime() - this.props.memory.createdAt;

        const remainingDelay = this.props.memory.toast.autoHideDelay ? this.props.memory.toast.autoHideDelay - age : undefined;
        const alreadyShown = !!this.props.memory.alreadyShown;
        this.props.memory.alreadyShown = true;

        let ageText = 'Just now';
        const step = Number(Math.ceil(age / AbstractToastComponent.timerUpdateInterval).toFixed(0));
        this.lastTimeStep = step;
        if (this.lastTimeStep > 1) ageText = `${(age / 1000).toFixed(0)} seconds ago`

        return (
            <div id={`toast${this.props.memory.toast.id}`} className={`toast${alreadyShown ? ' show fade' : ''}`} role="alert" aria-live="assertive" aria-atomic="true"
                data-bs-autohide={this.props.memory.toast.noAutoHide ? 'false' : 'true'}
                data-bs-delay={remainingDelay}>
                <div className="toast-header">
                    {this.props.memory.toast.icon ? <span className="material-icons toast-icon text-light">{this.props.memory.toast.icon}</span> : undefined}
                    <strong className="ms-1 me-auto text-light">{this.props.memory.toast.title}</strong>
                    <small className="text-muted">{ageText}</small>
                    <button type="button" className="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div className="toast-body pt-1 text-lighter">{this.getBody()}</div>
            </div>
        );
    }

    hiddenListener?: () => void;
    updateTimer?: number;

    componentDidMount() {
        const toast = document.getElementById(`toast${this.props.memory.toast.id}`);
        toast?.addEventListener('hidden.bs.toast', this.hiddenListener = () => this.props.onDestroy());

        this.updateTimer = window.setInterval(() => {
            this.setState({});
        }, AbstractToastComponent.timerUpdateInterval);
    }

    componentWillUnmount() {
        if (this.hiddenListener) {
            const toast = document.getElementById(`toast${this.props.memory.toast.id}`);
            toast?.removeEventListener('hidden.bs.toast', this.hiddenListener);
        }
        if (this.updateTimer !== undefined) clearInterval(this.updateTimer);
    }

    abstract getBody(): JSX.Element;
}

interface DownloadToastState {
    progress?: DownloadProgress
}

class DownloadToast extends AbstractToastComponent<DownloadToastState> {
    constructor(props: ToastProps) {
        super(props);
        this.state = {} as DownloadToastState;
    }

    getBody(): JSX.Element {
        const percent = this.state.progress ? Number((this.state.progress.currentProgress * 100).toFixed(0)) : undefined;
        return (
            <>
                <div className="d-flex align-items-center text-lighter">
                    <div className="fw-bold flex-fill">
                        {
                            this.state.progress ? (
                                <span className="me-1">
                                    {`(${this.state.progress.currentQueuePosition}/${this.state.progress.queueSize})`}
                                </span>
                            ) : undefined
                        }
                        {this.state.progress ? this.state.progress.currentDownload.title : undefined}
                    </div>
                    <div>{percent ? `${percent}%` : undefined}</div>
                </div>
                <div className="progress toast-progress">
                    <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow={percent !== undefined ? percent : 0} aria-valuemin={0} aria-valuemax={100} style={{ width: `${percent !== undefined ? percent : 0}%`}} />
                </div>
            </>
        );
    }

    protected progressListener?: (event: InstallerEvent) => void;

    componentDidMount() {
        super.componentDidMount();
        installationProgressManager.addEventListener('update-progress', this.progressListener = event => {
            if (!event.detail.progress) throw new Error('On update-progress: Progress is null');
            this.setState({
                progress: event.detail.progress
            });
        });
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        if (this.progressListener) installationProgressManager.removeEventListener('update-progress', this.progressListener);
    }
}

export default App;