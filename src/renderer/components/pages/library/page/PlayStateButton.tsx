import { Modal } from 'bootstrap';
import React, { Component } from 'react';
import App from "../../../../../common/types/App";
import AppState from "../../../../../common/types/AppState";
import DownloadProgress from "../../../../../common/types/DownloadProgress";
import { setDependencies } from '../../../../utils/dependencies';
import { installationProgressManager, InstallerEvent } from '../../../../utils/downloads';
import { DOWNLOADER } from '../../../../utils/ipc';
import LoadingSpinner from '../../../utility/LoadingSpinner';

interface PlayState {
    state?: AppState,
    progress?: DownloadProgress
}

interface ContentProps {
    app: App
}

class PlayStateButton extends Component<ContentProps, PlayState> {
    constructor(props: ContentProps) {
        super(props);
        this.state = {} as PlayState;
        this.updateStatus();
    }

    render() {
        const appType = this.props.app.type ? this.props.app.type : 'software';
        switch (this.state.state) {
            case undefined: return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-secondary d-flex align-items-center" disabled>
                        <LoadingSpinner className="app-btn-spinner" />
                    </button>
                    <div id="playDesc" className="ms-3 flex-fill">Loading...</div>
                </>
            );
            case 'not-installed': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-primary">Install</button>
                    <div id="playDesc" className="ms-3 flex-fill">Not yet installed</div>
                </>
            );
            case 'ready-to-play': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-success">{appType === 'game' ? 'Play' : 'Start'}</button>
                    <div id="playDesc" className="ms-3 flex-fill">{appType === 'game' ? 'Ready to play' : 'Ready to start'}</div>
                </>
            );
            case 'needs-update': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-info">Update</button>
                    <div id="playDesc" className="ms-3 flex-fill">Needs to be updated</div>
                </>
            );
            case 'installing': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-primary d-flex align-items-center" disabled>
                        <LoadingSpinner className="spinner-border-sm progress-spinner" />
                        <span className="ms-2">Installing</span>
                        {this.state.progress ? (
                            <span className="ms-1">{(this.state.progress.currentProgress * 100).toFixed(0)}%</span>
                        ) : undefined}
                    </button>
                    <div id="playDesc" className="ms-3 flex-fill">Currently installing...</div>
                </>
            );
            case 'updating': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-info d-flex align-items-center" disabled>
                        <LoadingSpinner className="spinner-border-sm progress-spinner" />
                        <span className="ms-2">Updating</span>
                        {this.state.progress ? (
                            <span className="ms-1">{(this.state.progress.currentProgress * 100).toFixed(0)}%</span>
                        ) : undefined}
                    </button>
                    <div id="playDesc" className="ms-3 flex-fill">Currently updating...</div>
                </>
            );
            case 'in-queue': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-info d-flex align-items-center" disabled>
                        <LoadingSpinner className="spinner-border-sm progress-spinner" />
                        <span className="ms-2">In queue</span>
                    </button>
                    <div id="playDesc" className="ms-3 flex-fill">Download pending...</div>
                </>
            );
            case 'outdated-launcher': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-secondary d-flex align-items-center" disabled>
                        <span className="ms-2">Outdated</span>
                    </button>
                    <div id="playDesc" className="ms-3 flex-fill">Please update LCLPLauncher</div>
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
        const playBtn = document.getElementById('playBtn');
        playBtn?.addEventListener('click', () => {
            switch (this.state.state) {
                case 'not-installed':
                    this.checkValidVersion(() => this.startInstallationOptions());
                    break;
                case 'needs-update':
                    this.checkValidVersion(() => this.startUpdate());
                    break;
                default:
                    break;
            }
        });

        const installBtn = document.getElementById('installBtn');
        const installationDirInput = document.getElementById('installDirInput');
        installBtn?.addEventListener('click', () => {
            if (!installationDirInput) return;

            const path = (installationDirInput as HTMLInputElement).value.trim();
            if (path.length <= 0) {
                alert('Please choose installation directory first!');
                return;
            }

            DOWNLOADER.isValidInstallationDir(path).then(valid => {
                if (valid !== null) {
                    this.getInstallationOptionsModal()?.hide();
                    this.startInstallation(path);
                }
            }).catch(err => {
                if (err instanceof Error && err.message === 'Operation cancelled.') return;
                console.error(err);
            });
        });

        installationProgressManager.addEventListener('update-state', this.progressListeners['update-state'] = event => {
            if (!event.detail.currentState) throw new Error('On update-state: Current state is null');
            this.setState({ state: event.detail.currentState });
        });
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

    checkValidVersion(callback: () => void) {
        DOWNLOADER.isLauncherInstallerVersionValid(this.props.app).then(valid => {
            if (valid === null) return; // called twice
            if (valid) callback();
            else alert(`'${this.props.app.title}' requires a newer version of LCLPLauncher. Please update your launcher first.`);
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
        DOWNLOADER.getUninstalledDependencies(this.props.app).then(uninstalledDeps => {
            if (!uninstalledDeps) return;
            if (uninstalledDeps.length > 0) {
                setDependencies(uninstalledDeps, true, () => this.startActualUpdate());
            } else this.startActualUpdate();
        }).catch(err => console.error(err));
    }

    startActualUpdate() {
        DOWNLOADER.getInstallationDir(this.props.app).then(installationDir => {
            if (installationDir === undefined) this.updateStatus(); // installation dir got deleted since last state check
            else if (installationDir !== null) this.startActualInstallation(installationDir);
        }).catch(err => console.error('Could not fetch installation directory:', err));
    }

    startInstallation(installationDir: string) {
        DOWNLOADER.getUninstalledDependencies(this.props.app).then(uninstalledDeps => {
            if (!uninstalledDeps) return;
            if (uninstalledDeps.length > 0) {
                setDependencies(uninstalledDeps, true, () => this.startActualInstallation(installationDir));
            } else this.startActualInstallation(installationDir);
        }).catch(err => console.error(err));
    }

    startActualInstallation(installationDir: string) {
        console.info(`Starting installation process of '${this.props.app.title}'...`);

        DOWNLOADER.startInstallationProcess(this.props.app, installationDir).then(success => {
            if (success === null) return; // Button clicked while installation process is running
            if (success) {
                console.info(`Installation of '${this.props.app.title}' has finished successfully.`);
                this.updateStatus();
            } else {
                console.error(`Could not complete installation process of '${this.props.app.title}'.`);
            }
        }).catch(error => console.error('Could not finish the installation process:', error));
    }
}

export default PlayStateButton;