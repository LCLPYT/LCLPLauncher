import ElectronLog from "electron-log";
import React, { Component } from "react";
import App from "../../../../../common/types/App";
import { translate as t } from "../../../../../common/utils/i18n";
import { DOWNLOADER, UTILITIES } from "../../../../utils/ipc";

class InstallationOptionsModal extends Component<{ app: App }> {
    render() {
        return (
            <div className="modal fade" id="installationOptionsModal" tabIndex={-1} aria-labelledby="installationOptionsModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title text-lighter" id="installationOptionsModalLabel">{t('install.title', this.props.app.title)}</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label={t('close')}></button>
                        </div>
                        <div className="modal-body">
                            <div className="mb-1">
                                <label htmlFor="installDirInput" className="form-label text-lighter">{t('install.install_dir')}</label>
                                <div className="input-group mb-1 custom-input-wrapper" aria-describedby="installDirHelp">
                                    <input type="text" className="form-control custom-input text-lighter" id="installDirInput" placeholder={t('install.install_dir') + '...'} aria-describedby="fileSelectorButton" />
                                    <button id="fileSelectorButton" className="input-group-text custom-input">{t('install.choose_dir')}</button>
                                </div>
                                <div id="installDirHelp" className="form-text">{t('install.choose_dir.desc', this.props.app.title)}</div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">{t('close')}</button>
                            <button type="button" id="installBtn" className="btn btn-primary">{t('install.action')}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    componentDidMount() {
        const installDirInput = document.getElementById('installDirInput');

        DOWNLOADER.getDefaultInstallationDir(this.props.app).then(path => {
            if (path && installDirInput) (installDirInput as HTMLInputElement).value = path;
        }).catch(err => ElectronLog.error(err));

        const fileSelectorButton = document.getElementById('fileSelectorButton');
        fileSelectorButton?.addEventListener('click', () => {
            UTILITIES.chooseFiles({
                title: t('install.dialog.install_dir'),
                properties: ['openDirectory', 'promptToCreate', 'dontAddToRecent']
            }).then(result => {
                if (!result || result.canceled || !installDirInput) return;

                const paths = result.filePaths;
                if (paths.length !== 1) throw new Error('Only one file must be chosen');

                (installDirInput as HTMLInputElement).value = result.filePaths[0];
            }).catch(err => ElectronLog.error('Error while choosing file:', err));
        });
    }
}

export default InstallationOptionsModal;