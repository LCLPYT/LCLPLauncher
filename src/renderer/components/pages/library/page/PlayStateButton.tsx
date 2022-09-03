import { Modal } from 'bootstrap';
import ElectronLog from 'electron-log';
import React, { Component } from 'react';
import App from "../../../../../common/types/App";
import AppState from "../../../../../common/types/AppState";
import DownloadProgress, { PackageDownloadProgress } from "../../../../../common/types/DownloadProgress";
import { CompiledInstallationInput } from '../../../../../common/types/InstallationInput';
import { InputMap } from '../../../../../common/types/InstallationInputResult';
import { translate as t } from '../../../../../common/utils/i18n';
import { setDependencies } from '../../../../event/dependencies';
import { installationProgressManager, InstallerEvent } from '../../../../event/downloads';
import { DOWNLOADER, LIBRARY } from '../../../../utils/ipc';
import LoadingSpinner from '../../../utility/LoadingSpinner';
import AdditionalInputModal from './AdditionalInputModal';

interface ContentProps {
    app: App,
    currentDialogSetter: (dialogId: string, dialog: JSX.Element | undefined) => void
}

interface PlayState {
    state?: AppState,
    pressedAction: boolean
}

class PlayStateButton extends Component<ContentProps, PlayState> {
    constructor(props: ContentProps) {
        super(props);
        this.state = {
            pressedAction: false
        };
        this.updateStatus();
    }

    render() {
        const appType = this.props.app.type ? this.props.app.type : 'software';
        switch (this.state.state) {
            case undefined: return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-secondary d-flex align-items-center" disabled>
                        <LoadingSpinner className="app-btn-spinner" />
                    </button>
                    <div id="playDesc" className="ms-2_5 flex-fill">{t('loading')}...</div>
                </>
            );
            case 'running':
                return (
                    <>
                        <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-danger">{t('page.detail.stop')}</button>
                        <div id="playDesc" className="ms-2_5 flex-fill">{t(appType === 'game' ? 'page.detail.game_running' : 'page.detail.app_running')}</div>
                    </>
                );
            case 'not-installed': return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-primary">{t('page.detail.install')}</button>
                    <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.not_yet_installed')}</div>
                </>
            );
            case 'ready-to-play': return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-success" disabled={this.state.pressedAction}>
                        {this.state.pressedAction ? (
                            <>
                                <LoadingSpinner className="spinner-border-sm progress-spinner" />
                                <span className="ms-2">{t('page.detail.starting')}</span>
                            </>
                        ) : t(appType === 'game' ? 'page.detail.play' : 'page.detail.start')}
                    </button>
                    <div id="playDesc" className="ms-2_5 flex-fill">
                        {this.state.pressedAction ? `${t('page.detail.starting')}...` : t(appType === 'game' ? 'page.detail.ready_play' : 'page.detail.ready_start')}
                    </div>
                </>
            );
            case 'needs-update': return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-info">{t('page.detail.update')}</button>
                    <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.needs_update')}</div>
                </>
            );
            case 'installing': return <InstallingButton />;
            case 'updating': return <UpdatingButton />;
            case 'in-queue': return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-info d-flex align-items-center" disabled>
                        <LoadingSpinner className="spinner-border-sm progress-spinner" />
                        <span className="ms-2">{t('page.detail.in_queue')}</span>
                    </button>
                    <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.download_pending')}</div>
                </>
            );
            case 'preinstalling': return <PreInstallingButton />;
            case 'outdated-launcher': return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-secondary d-flex align-items-center" disabled>
                        <span className="ms-2">{t('page.detail.outdated')}</span>
                    </button>
                    <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.please_update')}</div>
                </>
            );
            case 'unsupported-platform': return (
                <>
                    <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-secondary d-flex align-items-center" disabled>
                        <span className="ms-2">{t('page.detail.unsupported')}</span>
                    </button>
                    <div id="playDesc" className="ms-2_5 flex-fill">{t(appType === 'game' ? 'page.detail.unsupported_game' : 'page.detail.unsupported_app')}</div>
                </>
            );
            default:
                throw new Error(`Unimplemented state: '${this.state.state}'`);
        }
    }

    updateStatus() {
        DOWNLOADER.getAppStatus(this.props.app).then(state => {
            this.setState({ state: state });
        }).catch(err => console.error('Could not fetch app status:', err));
    }

    protected progressListeners: {
        [type: string]: (event: InstallerEvent) => void
    } = {};

    componentDidMount() {
        this.initPlayButton();

        const installBtn = document.getElementById('installBtn');
        const installationDirInput = document.getElementById('installDirInput');
        installBtn?.addEventListener('click', () => {
            if (!installationDirInput) return;

            const path = (installationDirInput as HTMLInputElement).value.trim();
            if (path.length <= 0) {
                alert(t('install.location_empty'));
                return;
            }

            DOWNLOADER.isValidInstallationDir(path).then(valid => {
                if (valid !== null) {
                    this.getInstallationOptionsModal()?.hide();
                    this.fetchInputs(path);
                }
            }).catch(err => {
                if (err instanceof Error && err.message === 'Operation cancelled.') return;
                ElectronLog.error(err);
            });
        });

        installationProgressManager.addEventListener('update-state', this.progressListeners['update-state'] = event => {
            if (!event.detail.currentState) { // cause manual update
                this.updateStatus();
            } else this.setState({ state: event.detail.currentState });
        });
    }

    componentDidUpdate() {
        this.initPlayButton();
    }

    protected oldPlayBtn?: HTMLElement;
    protected clickListener?: () => void
    
    initPlayButton() {
        const playBtn = document.getElementById('playBtn');
        if (!playBtn) return;

        if (this.oldPlayBtn && this.clickListener) this.oldPlayBtn.removeEventListener('click', this.clickListener);
        this.oldPlayBtn = playBtn;

        playBtn.addEventListener('click', this.clickListener = () => {
            switch (this.state.state) {
                case 'not-installed':
                    this.checkValidVersion(() => this.startInstallationOptions());
                    break;
                case 'needs-update':
                    this.checkValidVersion(() => this.startUpdate());
                    break;
                case 'ready-to-play':
                    if (this.state.pressedAction) return;

                    this.setState({ pressedAction: true });

                    LIBRARY.startApp(this.props.app).then(started => {
                        if (started) {
                            DOWNLOADER.getAppStatus(this.props.app)
                                .then(state => this.setState({
                                    pressedAction: false,
                                    state: state
                                }))
                                .catch(err => {
                                    ElectronLog.error('Error fetching app state:', err);
                                    this.setState({ pressedAction: false });
                                })
                        }
                    }).catch(err => {
                        ElectronLog.error('Error starting app:', err)
                        this.setState({ pressedAction: false });
                    });
                    break;
                case 'running':
                    if (this.state.pressedAction) return;

                    this.setState({ pressedAction: true });

                    LIBRARY.stopApp(this.props.app).then(stopped => {
                        if (stopped === null) return;
                        if (!stopped) ElectronLog.warn('Could not stop', this.props.app.title);
                        DOWNLOADER.getAppStatus(this.props.app)
                            .then(state => this.setState({
                                pressedAction: false,
                                state: state
                            }))
                            .catch(err => {
                                ElectronLog.error('Error fetching app state:', err);
                                this.setState({ pressedAction: false });
                            });
                    }).catch(err => {
                        ElectronLog.error('Error fetching app state:', err);
                        this.setState({ pressedAction: false });
                    });
                    break;
                default:
                    break;
            }
        });
    }

    componentWillUnmount() {
        Object.entries(this.progressListeners).forEach(([type, listener]) => {
            installationProgressManager.removeEventListener(type, listener)
        });
    }

    checkValidVersion(callback: () => void) {
        DOWNLOADER.isLauncherInstallerVersionValid(this.props.app).then(valid => {
            if (valid === null) return; // called twice
            if (valid) callback();
            else alert(t('page.detail.alert_outdated', this.props.app.title));
        });
    }

    getInstallationOptionsModal() {
        const modalElement = document.getElementById('installationOptionsModal');
        if (modalElement) {
            const modalInstance = Modal.getInstance(modalElement);
            return modalInstance ? modalInstance : new Modal(modalElement);
        } else return null;
    }

    startInstallationOptions() {
        this.getInstallationOptionsModal()?.show();
    }

    startUpdate() {
        DOWNLOADER.getInstallationDir(this.props.app).then(installationDir => {
            if (installationDir === undefined) this.updateStatus(); // installation dir got deleted since last state check
            else this.fetchInputs(installationDir);
        }).catch(err => ElectronLog.error('Could not fetch installation directory:', err));
    }

    protected cachedInstallationDir?: string;
    protected additionalInputs?: CompiledInstallationInput[];
    protected map?: InputMap;

    fetchInputs(installationDir: string) {
        this.cachedInstallationDir = installationDir;
        DOWNLOADER.getAdditionalInputs(this.props.app, installationDir).then(result => {
            if (result === null) return; // called twice
            this.additionalInputs = result.inputs
            this.map = result.map;
            this.askNextInput();
        }).catch(err => ElectronLog.error('Could not fetch additional inputs:', err));
    }

    askNextInput() {
        if (!this.additionalInputs || this.additionalInputs.length <= 0) {
            this.askForDependencies();
            return;
        }

        if (!this.map) throw new Error('Input map is undefined');

        const removed = this.additionalInputs.splice(0, 1);
        if (removed.length !== 1) throw new Error('There must be only one removed element.');

        const dialog = <AdditionalInputModal input={removed[0]} map={this.map} next={() => this.askNextInput()} />;
        this.props.currentDialogSetter(`inmod_${removed[0].id}`, dialog);
    }

    askForDependencies() {
        if (!this.cachedInstallationDir) throw new Error('Installation dir unknown.');

        const installationDir = this.cachedInstallationDir;
        this.cachedInstallationDir = undefined;

        const map = this.map;
        if (!map) throw new Error('Input map is undefined.');

        this.map = undefined;

        DOWNLOADER.getUninstalledDependencies(this.props.app).then(uninstalledDeps => {
            if (!uninstalledDeps) return;
            if (uninstalledDeps.length > 0) {
                setDependencies(uninstalledDeps, true, () => this.startActualInstallation(installationDir, map));
            } else this.startActualInstallation(installationDir, map);
        }).catch(err => ElectronLog.error(err));
    }

    startActualInstallation(installationDir: string, map: InputMap) {
        ElectronLog.info(`Starting installation process of '${this.props.app.title}'...`);

        DOWNLOADER.startInstallationProcess(this.props.app, installationDir, map).then(success => {
            if (success === null) return; // Button clicked while installation process is running
            if (success) {
                ElectronLog.info(`Installation of '${this.props.app.title}' has finished successfully.`);
                this.updateStatus();
            } else {
                ElectronLog.error(`Could not complete installation process of '${this.props.app.title}'.`);
            }
        }).catch(error => {
            ElectronLog.error('Could not finish the installation process:', error)
            this.updateStatus();
        });
    }
}

interface InstallingState {
    progress?: DownloadProgress
}

class InstallingButton extends Component<{}, InstallingState> {
    constructor(props: {}) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <>
                <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-primary d-flex align-items-center" disabled>
                    <LoadingSpinner className="spinner-border-sm progress-spinner" />
                    <span className="ms-2">{t('page.detail.installing')}</span>
                    {this.state.progress ? (
                        <span className="ms-1">{(this.state.progress.currentProgress * 100).toFixed(0)}%</span>
                    ) : undefined}
                </button>
                <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.currently_installing')}</div>
            </>
        )
    }

    protected progressListeners: {
        [type: string]: (event: InstallerEvent) => void
    } = {};

    componentDidMount() {
        installationProgressManager.addEventListener('update-progress', this.progressListeners['update-progress'] = event => {
            if (!event.detail.progress) throw new Error('On update-progress: Progress is null');
            this.setState({ progress: event.detail.progress });
        });
    }

    componentWillUnmount() {
        Object.entries(this.progressListeners).forEach(([type, listener]) => {
            installationProgressManager.removeEventListener(type, listener)
        });
    }
}

class UpdatingButton extends Component<{}, InstallingState> {
    constructor(props: {}) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <>
                <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-info d-flex align-items-center" disabled>
                    <LoadingSpinner className="spinner-border-sm progress-spinner" />
                    <span className="ms-2">{t('page.detail.updating')}</span>
                    {this.state.progress ? (
                        <span className="ms-1">{(this.state.progress.currentProgress * 100).toFixed(0)}%</span>
                    ) : undefined}
                </button>
                <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.currently_updating')}</div>
            </>
        )
    }

    protected progressListeners: {
        [type: string]: (event: InstallerEvent) => void
    } = {};

    componentDidMount() {
        installationProgressManager.addEventListener('update-progress', this.progressListeners['update-progress'] = event => {
            if (!event.detail.progress) throw new Error('On update-progress: Progress is null');
            this.setState({ progress: event.detail.progress });
        });
    }

    componentWillUnmount() {
        Object.entries(this.progressListeners).forEach(([type, listener]) => {
            installationProgressManager.removeEventListener(type, listener)
        });
    }
}

interface PreInstallingState {
    progress?: PackageDownloadProgress
}

class PreInstallingButton extends Component<{}, PreInstallingState> {
    constructor(props: {}) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <>
                <button id="playBtn" className="px-4_5 btn btn-xl fw-bold btn-secondary d-flex align-items-center" disabled>
                    <LoadingSpinner className="spinner-border-sm progress-spinner" />
                    <span className="ms-2">{t('page.detail.preinstalling')}</span>
                    {this.state.progress ? (
                        <span className="ms-1">{this.state.progress.currentQueuePosition}/{this.state.progress.queueSize}</span>
                    ) : undefined}
                </button>
                <div id="playDesc" className="ms-2_5 flex-fill">{t('page.detail.currently_preinstalling')}</div>
            </>
        )
    }

    protected progressListeners: {
        [type: string]: (event: InstallerEvent) => void
    } = {};

    componentDidMount() {
        installationProgressManager.addEventListener('update-package-progress', this.progressListeners['update-package-progress'] = event => {
            if (!event.detail.packageProgress) throw new Error('On update-progress: Progress is null');
            this.setState({ progress: event.detail.packageProgress });
        });
    }

    componentWillUnmount() {
        Object.entries(this.progressListeners).forEach(([type, listener]) => {
            installationProgressManager.removeEventListener(type, listener)
        });
    }
}

export default PlayStateButton;