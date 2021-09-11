import { ProgressInfo } from 'electron-updater';
import React, { Component } from 'react';
import UpdateCheckResult from '../../common/types/UpdateCheckResult';
import { formatBytes } from '../../common/utils/utils';
import { UPDATER, UTILITIES } from '../utils/ipc';
import { UpdaterEvent, updaterManager } from '../utils/updater';
import LoadingSpinner from './utility/LoadingSpinner';

interface Props {
    result?: UpdateCheckResult
}

interface State {
    data?: UpdateCheckResult,
    downloading?: boolean,
    error?: any,
    progress?: ProgressInfo
}

class UpdateChecking extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            data: this.props.result
        };
    }

    render() {
        if (this.state.error) return (
            <div className="p-2 h-100 custom-scrollbar overflow-scroll text-lighter">
                <h4>Error while updating</h4>
                <div>
                    If the problem persists, try to reinstall LCLPLauncher. <br/>
                    Yet, if that doesn't help, feel free to <a className="cursor-pointer" href="https://github.com/LCLPYT/LCLPLauncher/issues">contact us</a>.
                </div>
                <div className="mt-2 p-2 bg-dark rounded d-flex align-items-center">
                    <code>
                        {this.state.error instanceof Error ? this.state.error.stack : `${this.state.error}`}
                    </code>
                </div>
            </div>
        );

        if (this.state.downloading) {
            let percent = '0';
            let downloaded = '0 MB';
            let total = '0 MB';
            let downloadSpeed = '0 MB';

            if (this.state.progress) {
                percent = this.state.progress.percent.toFixed(2);
                downloaded = formatBytes(this.state.progress.transferred);
                total = formatBytes(this.state.progress.total);
                downloadSpeed = formatBytes(this.state.progress.bytesPerSecond);
            }

            return (
                <div className="p-2 h-100 d-flex align-items-center flex-column justify-content-center text-lighter overflow-hidden">
                    <div className="w-100 d-flex align-items-center justify-content-center text-lighter">
                        <LoadingSpinner noMargin={true} />
                        <h4 className="ms-3 mb-0">Downloading Update</h4>
                    </div>
                    <div className="w-100 mt-2 d-flex justify-content-between align-items-center text-light">
                        <span className="ms-4">{percent}%</span>
                        <span className="ps-5">{downloaded} / {total}</span>
                        <span className="me-4">@{downloadSpeed}/s</span>
                    </div>
                </div>
            );
        }

        if (!this.state.data) return (
            <div className="py-2 h-100 d-flex align-items-center justify-content-center text-lighter overflow-hidden">
                <LoadingSpinner noMargin={true} />
                <h4 className="ms-3 mb-0">Checking for Updates</h4>
            </div>
        );
        else {
            let title: string | undefined;
            let desc: string | undefined;
            let laterText: string | undefined;
            if (!!this.state.data.mandatory) {
                title = 'Mandatory update';
                desc = 'A mandatory update has to be installed. Do you want to install it now?';
                laterText = 'Exit';
            } else {
                title = 'Update available';
                desc = 'An update is available. Do you want to install it now or later?';
                laterText = 'Update later'
            }
            return (
                <div className="py-2 h-100 overflow-hidden d-flex flex-column align-items-center justify-content-center">
                    <h4 className="text-lighter mb-1">{title}</h4>
                    <div className="text-light px-2">{desc}</div>
                    <div className="d-flex w-100 mt-1 align-items-center justify-content-around">
                        <button id="updateLater" className="btn btn-sm btn-danger">{laterText}</button>
                        <button id="updateNow" className="btn btn-sm btn-success">Update</button>
                    </div>
                </div>
            );
        }
    }

    protected updaterListeners: {
        [type: string]: (event: UpdaterEvent) => void
    } = {};

    componentDidMount() {
        updaterManager.addEventListener('update-state', this.updaterListeners['update-state'] = event => {
            if (!event.detail.state) throw new Error('State is undefined');
            if (event.detail.state.updateAvailable) this.setState({
                data: event.detail.state
            });
        });
        updaterManager.addEventListener('update-error', this.updaterListeners['update-error'] = event => {
            if (!event.detail.error) throw new Error('Error is undefined');
            this.setState({
                error: event.detail.error
            });
        });
        updaterManager.addEventListener('update-progress', this.updaterListeners['update-progress'] = event => {
            if (!event.detail.progress) throw new Error('Progress is undefined');
            this.setState({
                progress: event.detail.progress
            });
        });

        this.update();
    }

    componentDidUpdate() {
        this.update();
    }

    protected lastLaterBtn?: HTMLElement;
    protected laterListener?: () => void;
    protected lastUpdateBtn?: HTMLElement;
    protected updateListener?: () => void;

    update() {
        const updateLater = document.getElementById('updateLater');
        if (updateLater) {
            this.lastLaterBtn = updateLater;
            updateLater.addEventListener('click', this.laterListener = () => {
                if (!this.state.data) return;
                if (this.state.data.mandatory) UTILITIES.exitApp();
                else UPDATER.skipUpdate();
            });
        }

        const updateNow = document.getElementById('updateNow');
        if (updateNow) {
            this.lastUpdateBtn = updateNow;
            updateNow.addEventListener('click', this.updateListener = () => {
                if (this.state.data) UPDATER.startUpdate().then(updateStarted => {
                    if (updateStarted) this.setState({ downloading: true });
                }).catch(err => console.error('Could not start download:', err));
            });
        }
    }

    componentWillUnmount() {
        Object.entries(this.updaterListeners).forEach(([type, listener]) => {
            updaterManager.removeEventListener(type, listener)
        });
        if (this.lastLaterBtn && this.laterListener) this.lastLaterBtn.removeEventListener('click', this.laterListener);
    }
}

export default UpdateChecking;