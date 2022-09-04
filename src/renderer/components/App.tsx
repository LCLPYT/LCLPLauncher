import {Toast} from 'bootstrap';
import React, {Component} from 'react';
import {HashRouter, Redirect, Route, Switch} from 'react-router-dom';
import ToastOptions, {ToastType} from '../../common/types/Toast';
import {ToastEvent, toastManager} from '../event/toasts';
import Menubar from './Menubar';
import Home from './pages/Home';
import Library from './pages/Library';
import Settings from './pages/Settings';

import DownloadProgress, {PackageDownloadProgress} from '../../common/types/DownloadProgress';
import {getToastSoundVolume, shouldPlayToastSound} from '../../common/utils/settings';
import toastSound from '../sound/toast.ogg';
import {installationProgressManager, InstallerEvent} from '../event/downloads';
import {UPDATER} from '../utils/ipc';
import ElectronLog from 'electron-log';
import {UpdaterEventListenerOrObject, updaterManager} from '../event/updater';
import {ProgressInfo} from 'electron-updater';
import LoadingSpinner from './utility/LoadingSpinner';
import { translate as t } from '../../common/utils/i18n';

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

                        <Redirect to="/" /> {/* Fallback route */}
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

            const toast = event.detail.toast;

            this.setState({
                toasts: [...this.state.toasts, {
                    toast: toast,
                    createdAt: new Date().getTime()
                }]
            });

            if (!toast.noSound && shouldPlayToastSound()) {
                const audio = new Audio(toastSound);
                audio.volume = getToastSoundVolume();
                audio.play();
            }
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
            if (!instance) new Toast(element).show();
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

        const props: React.ClassAttributes<any> & ToastProps = {
            key: key,
            memory: memory,
            onDestroy: () => onDestroy()
        };

        switch (memory.toast.type) {
            case ToastType.TEXT: return <TextToast {...props} />;
            case ToastType.DOWNLOAD_STATUS: return <DownloadToast {...props} />;
            case ToastType.PACKAGE_DOWNLOAD_STATUS: return <PackageDownloadToast {...props} />;
            case ToastType.UPDATE_AVAILABLE: return <UpdateAvailableToast {...props} />
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

        let ageText = t('toast.just_now');
        this.lastTimeStep = Number(Math.ceil(age / AbstractToastComponent.timerUpdateInterval).toFixed(0));
        if (this.lastTimeStep > 1) ageText = t('toast.age', (age / 1000).toFixed(0));

        return (
            <div id={`toast${this.props.memory.toast.id}`} className={`toast${alreadyShown ? ' show fade' : ''}`} role="alert" aria-live="assertive" aria-atomic="true"
                data-bs-autohide={this.props.memory.toast.noAutoHide ? 'false' : 'true'}
                data-bs-delay={remainingDelay}>
                <div className="toast-header">
                    {this.props.memory.toast.icon ? <span className="material-icons toast-icon text-light">{this.props.memory.toast.icon}</span> : undefined}
                    <strong className="ms-1 me-auto text-light">{this.props.memory.toast.title}</strong>
                    <small className="text-muted">{ageText}</small>
                    <button type="button" className="btn-close" data-bs-dismiss="toast" aria-label={t('close')}></button>
                </div>
                <div className="toast-body py-1 text-lighter">{this.getBody()}</div>
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

class TextToast extends AbstractToastComponent {
    getBody(): JSX.Element {
        const text = this.props.memory.toast ? this.props.memory.toast.detail as string : undefined;
        return <div className="py-1 text-lighter">{text}</div>;
    }
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
                        {this.state.progress?.currentDownload.title}
                    </div>
                    <div>{percent ? `${percent}%` : undefined}</div>
                </div>
                <div className="progress toast-progress">
                    <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" 
                        aria-valuenow={percent !== undefined ? percent : 0} aria-valuemin={0} aria-valuemax={100} 
                        style={{ width: `${percent !== undefined ? percent : 0}%`}} />
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

interface PackageDownloadToastState {
    progress?: PackageDownloadProgress
}

class PackageDownloadToast extends AbstractToastComponent<PackageDownloadToastState> {
    constructor(props: ToastProps) {
        super(props);
        this.state = {} as PackageDownloadToastState;
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
                        {this.state.progress?.packageName}
                    </div>
                    <div>{percent ? `${percent}%` : undefined}</div>
                </div>
                <div className="progress toast-progress">
                    <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" 
                        aria-valuenow={percent !== undefined ? percent : 0} aria-valuemin={0} aria-valuemax={100} 
                        style={{ width: `${percent !== undefined ? percent : 0}%`}} />
                </div>
            </>
        );
    }

    protected progressListener?: (event: InstallerEvent) => void;

    componentDidMount() {
        super.componentDidMount();
        installationProgressManager.addEventListener('update-package-progress', this.progressListener = event => {
            if (!event.detail.packageProgress) throw new Error('On update-package-progress: Progress is null');

            this.setState({
                progress: event.detail.packageProgress
            });
        });
    }

    componentWillUnmount() {
        super.componentWillUnmount();
        if (this.progressListener) installationProgressManager.removeEventListener('update-package-progress', this.progressListener);
    }
}

class UpdateAvailableToast extends AbstractToastComponent<{
    updateInProgress: boolean,
    progress?: ProgressInfo
}> {
    
    private dlBtnRef = React.createRef<HTMLButtonElement>();
    private dlProgress = React.createRef<HTMLDivElement>();
    private clickListener?: () => void;
    private progressListener?: UpdaterEventListenerOrObject;

    constructor(props: ToastProps) {
        super(props);
        this.state = {
            updateInProgress: false
        };
    }

    getBody(): JSX.Element {
        if (!this.state.updateInProgress) {
            const versionName = this.props.memory.toast ? this.props.memory.toast.detail as string : undefined;
            const text = versionName ? t('toast.update.available', versionName) + ' ' : '';

            return (
                <div className="py-1 text-lighter">
                    {text + t('toast.update.ask')}
                    <div className="mt-1">
                        <button type="button" className="btn btn-primary btn-sm me-2" ref={this.dlBtnRef}>{t('toast.update.download')}</button>
                        <button type="button" className="btn btn-dark btn-sm" data-bs-dismiss="toast" aria-label={t('close')}>{t('toast.update.later')}</button>
                    </div>
                </div>
            );
        }

        if (!this.state.progress) {
            return (
                <div className="py-1 text-lighter d-flex align-items-center justify-content-center">
                    <span>{t('toast.update.starting')}</span>
                    <LoadingSpinner className="spinner-border-sm ms-2" />
                </div>
            );
        }
        
        const progress = Math.floor(this.state.progress.percent);

        return (
            <div className="py-1 text-lighter">
                {t('toast.update.progress', this.state.progress.percent.toFixed(2))}

                <div className="progress mt-1">
                    <div className="progress-bar progress-bar-striped progress-bar-animated" 
                        role="progressbar" style={{width: `${progress}%`}} 
                        aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} 
                        ref={this.dlProgress} />
                </div>
            </div>
        );
    }

    componentDidMount(): void {
        this.dlBtnRef.current?.addEventListener('click', this.clickListener = () => {
            UPDATER.startUpdate().then(updateStarted => {
                if (updateStarted) {
                    this.setState({updateInProgress: true});
                    ElectronLog.info('Update started.');
                }
            }).catch(err => ElectronLog.error('Could not start download:', err));
        });

        updaterManager.addEventListener('update-progress', this.progressListener = event => {
            if (event.detail.progress) {
                this.setState({
                    progress: event.detail.progress
                });
            }
        });
    }

    componentWillUnmount(): void {
        if (this.clickListener) {
            this.dlBtnRef.current?.removeEventListener('click', this.clickListener);
        }

        if (this.progressListener) {
            updaterManager.removeEventListener('update-progress', this.progressListener);
        }
    }
}

export default App;