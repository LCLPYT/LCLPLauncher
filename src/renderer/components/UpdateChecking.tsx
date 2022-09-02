import { ProgressInfo } from 'electron-updater';
import React, { Component } from 'react';
import { formatBytes } from '../../common/utils/utils';
import { UPDATER, UTILITIES } from '../utils/ipc';
import { UpdaterEvent, updaterManager } from '../event/updater';
import LoadingSpinner from './utility/LoadingSpinner';
import ElectronLog from 'electron-log';
import { translate as t } from '../../common/utils/i18n';

interface Props {
    error?: any
}

interface State {
    downloading?: boolean,
    error?: any,
    progress?: ProgressInfo
}

class UpdateChecking extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            error: this.props.error
        };
    }

    render() {
        if (this.state.error) return (
            <div className="p-2 h-100 custom-scrollbar overflow-scroll text-lighter">
                <h4>{t('updater.error')}</h4>
                <div>
                    {t('updater.error_hint')}
                    <a className="cursor-pointer" href="https://github.com/LCLPYT/LCLPLauncher/issues">GitHub Issues</a>
                </div>
                <div className="mt-2 p-2 bg-dark rounded d-flex align-items-center">
                    <code className="w-100 text-wrap">
                        {this.state.error instanceof Error ? this.state.error.stack : `${this.state.error}`}
                    </code>
                </div>
            </div>
        );

        if (this.state.downloading) {
            if (!this.state.progress) {
                return (
                    <div className="container h-100 p-2 d-flex align-items-center flex-column justify-content-center text-lighter overflow-hidden">
                        <h2>{t('updater.downloading')}</h2>
                        <div className="d-flex align-items-center justify-content-center mt-2">
                            <span>{t('updater.starting')}</span>
                            <LoadingSpinner className="spinner-border-sm ms-2" />
                        </div>
                    </div>
                );
            }

            const percent = Math.floor(this.state.progress.percent);
            const downloaded = formatBytes(this.state.progress.transferred);
            const total = formatBytes(this.state.progress.total);
            const downloadSpeed = formatBytes(this.state.progress.bytesPerSecond);

            return (
                <div className="container h-100 p-2 d-flex align-items-center flex-column justify-content-center text-lighter overflow-hidden">
                    <h2>{t('updater.downloading')}</h2>
                    <div className="w-75">
                        <div className="progress">
                            <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" 
                                aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} style={{width: `${percent}%`}} />
                        </div>
                        <div className="d-flex align-items-center justify-content-around mt-2">
                            <span>{this.state.progress.percent.toFixed(2)}%</span>
                            <span>{downloaded} / {total}</span>
                            <span>{downloadSpeed}/s</span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="py-2 h-100 overflow-hidden d-flex flex-column align-items-center justify-content-center">
                <h4 className="text-lighter mb-1">{t('updater.mandatory')}</h4>
                <div className="text-light px-2">{t('updater.mandatory.ask')}</div>
                <div className="d-flex w-50 mt-2 align-items-center justify-content-around">
                    <button id="updateLater" className="btn btn-sm btn-danger">{t('exit')}</button>
                    <button id="updateNow" className="btn btn-sm btn-success">{t('updater.update')}</button>
                </div>
            </div>
        );
    }

    protected updaterListeners: {
        [type: string]: (event: UpdaterEvent) => void
    } = {};

    componentDidMount() {
        updaterManager.addEventListener('update-error', this.updaterListeners['update-error'] = event => {
            if (!event.detail.error) throw new Error('Error is undefined');
            this.setState({
                error: event.detail.error
            });
        });
        updaterManager.addEventListener('update-progress', this.updaterListeners['update-progress'] = event => {
            if (!event.detail.progress) throw new Error('Progress is undefined');
            
            const stateUpdate: Partial<State> = {
                progress: event.detail.progress
            };

            if (!this.state.downloading) stateUpdate.downloading = true;

            this.setState(stateUpdate);
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
            updateLater.addEventListener('click', this.laterListener = () => UTILITIES.exitApp());
        }

        const updateNow = document.getElementById('updateNow');
        if (updateNow) {
            this.lastUpdateBtn = updateNow;
            updateNow.addEventListener('click', this.updateListener = () => {
                UPDATER.startUpdate().then(updateStarted => {
                    if (updateStarted) this.setState({ downloading: true });
                }).catch(err => ElectronLog.error('Could not start download:', err));
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