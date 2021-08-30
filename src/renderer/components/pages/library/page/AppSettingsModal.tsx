import { Modal } from "bootstrap";
import React, { Component } from "react";
import App from "../../../../../common/types/App";
import AppState from "../../../../../common/types/AppState";
import { installationProgressManager, InstallerEvent } from "../../../../utils/downloads";
import { DOWNLOADER } from "../../../../utils/ipc";
import LoadingSpinner from "../../../utility/LoadingSpinner";

interface ModalProps {
    app: App,
}

interface ModalState {
    state?: AppState
}

class AppSettingsModal extends Component<ModalProps, ModalState> {
    constructor(props: ModalProps) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div className="modal fade" id="appSettingsModal" tabIndex={-1} aria-labelledby="appSettingsModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title text-lighter" id="appSettingsModalLabel">App Settings</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            {this.state.state ? <ModalBody app={this.props.app} state={this.state.state} /> : <Loading />}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    protected stateListener?: (event: InstallerEvent) => void;

    componentDidMount() {
        installationProgressManager.addEventListener('update-state', this.stateListener = event => {
            if (!event.detail.currentState) throw new Error('On update-state: Current state is null');
            this.setState({
                state: event.detail.currentState
            });
        });

        DOWNLOADER.getAppStatus(this.props.app)
            .then(state => this.setState({
                state: state
            }))
            .catch(err => console.error(err));
    }

    componentWillUnmount() {
        if (this.stateListener) installationProgressManager.removeEventListener('update-state', this.stateListener);
    }
}

class Loading extends Component {
    render() {
        return (
            <div className="text-center">
                <LoadingSpinner />
            </div>
        );
    }
}

interface BodyProps {
    app: App,
    state: AppState
}

interface BodyState {
    installationDir?: string
}

class ModalBody extends Component<BodyProps, BodyState> {
    constructor(props: BodyProps) {
        super(props);
        this.state = {};
    }

    render() {
        if (this.props.state === 'not-installed') return (
            <div className="text-center text-lighter">
                <span className="fw-bold">{this.props.app.title}</span> is not yet installed.
            </div>
        );
        return (
            <>
                {this.state.installationDir ? (
                    <div className="d-flex align-items-center text-lighter">
                        <span className="flex-fill">Installation directory:</span>
                        <code className="bg-dark rounded px-1 selectable">{this.state.installationDir}</code>
                    </div>
                ) : undefined}
                <div className="mt-2 d-flex justify-content-end">
                    <button id="uninstallBtn" className="btn btn-danger">Uninstall</button>
                </div>
            </>
        );
    }

    componentDidMount() {
        DOWNLOADER.getInstallationDir(this.props.app).then(dir => {
            this.setState({
                installationDir: dir
            });
        }).catch(err => console.error(err));

        const uninstallBtn = document.getElementById('uninstallBtn');
        uninstallBtn?.addEventListener('click', () => {
            if (confirm(`Are you sure you want to uninstall '${this.props.app.title}'?`)) {
                DOWNLOADER.uninstall(this.props.app)
                    .then(() => {
                        const appSettingsModal = document.getElementById('appSettingsModal');
                        if (appSettingsModal) Modal.getInstance(appSettingsModal)?.hide();
                    })
                    .catch(err => console.error('Error uninstalling app:', err));
            }
        });
    }
}

export default AppSettingsModal;