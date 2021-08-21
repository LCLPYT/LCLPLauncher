import { Toast } from 'bootstrap';
import React, { Component } from 'react';
import { HashRouter, Redirect, Route, Switch } from 'react-router-dom';
import { ToastEvent, toastManager } from '../utils/toasts';
import Menubar from './Menubar';
import Home from './pages/Home';
import Library from './pages/Library';
import Settings from './pages/Settings';
import ToastProps, { ToastType } from '../../common/types/Toast';

import toastSound from '../sound/toast.ogg';

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
    toast: ToastProps,
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
            this.setState({
                toasts: [...this.state.toasts, {
                    toast: event.detail.toast,
                    createdAt: new Date().getTime()
                }]
            });
            new Audio(toastSound).play();
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
            case ToastType.DOWNLOAD_STATUS: return <DownloadToast key={key} memory={memory} index={key} onDestroy={() => onDestroy()} />
            default:
                throw new Error(`Unimplemented toast type: '${memory.toast.type}'`);
        }
    }
}

abstract class AbstractToastComponent extends Component<{ memory: ToastMemory, index: React.Key, onDestroy: () => void }> {
    render() {
        const remainingDelay = this.props.memory.toast.autoHideDelay ? this.props.memory.toast.autoHideDelay - new Date().getTime() + this.props.memory.createdAt : undefined;
        const alreadyShown = this.props.memory.alreadyShown ? true : false;
        this.props.memory.alreadyShown = true;
        return (
            <div id={`toast${this.props.index}`} className={`toast${alreadyShown ? ' show fade' : ''}`} role="alert" aria-live="assertive" aria-atomic="true" 
                data-bs-autohide={this.props.memory.toast.noAutoHide ? 'false' : 'true'}
                data-bs-delay={remainingDelay}>
                <div className="toast-header">
                    {this.props.memory.toast.icon ? <span className="material-icons toast-icon text-light">{this.props.memory.toast.icon}</span> : undefined}
                    <strong className="ms-1 me-auto text-light">{this.props.memory.toast.title}</strong>
                    <small className="text-muted">2 seconds ago</small>
                    <button type="button" className="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div className="toast-body pt-1 text-lighter">{this.getBody()}</div>
            </div>
        );
    }

    hiddenListener?: () => void;

    componentDidMount() {
        const toast = document.getElementById(`toast${this.props.index}`);
        toast?.addEventListener('hidden.bs.toast', this.hiddenListener = () => this.props.onDestroy());
    }

    componentWillUnmount() {
        if (this.hiddenListener) {
            const toast = document.getElementById(`toast${this.props.index}`);
            toast?.removeEventListener('hidden.bs.toast', this.hiddenListener);
        }
    }

    abstract getBody(): JSX.Element;
}

class DownloadToast extends AbstractToastComponent {
    getBody(): JSX.Element {
        return (
            <>
                <div className="d-flex align-items-center text-lighter">
                    <div className="fw-bold flex-fill">(1/1) LCLPServer 5.0</div>
                    <div>75%</div>
                </div>
                <div className="progress toast-progress">
                    <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100} style={{ width: '75%' }}></div>
                </div>
            </>
        );
    }
}

export default App;