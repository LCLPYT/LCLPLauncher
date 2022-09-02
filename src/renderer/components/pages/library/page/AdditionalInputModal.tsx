import { Modal } from "bootstrap";
import ElectronLog from "electron-log";
import React, { Component } from "react";
import { CompiledInstallationInput } from "../../../../../common/types/InstallationInput";
import { InputMap } from "../../../../../common/types/InstallationInputResult";
import { translate as t } from "../../../../../common/utils/i18n";
import { UTILITIES } from "../../../../utils/ipc";

interface Props {
    input: CompiledInstallationInput,
    map: InputMap,
    next: () => void
}

class AdditionalInputModal extends Component<Props> {
    render() {
        const id = `inmod_${this.props.input.id}`;
        const labelId = `${id}_label`;
        const inputId = `${id}_in`;

        return (
            <div className="modal fade" id={id} tabIndex={-1} aria-labelledby={labelId} aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title text-lighter" id={labelId}>{`Input ${this.props.input.title}`}</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label={t('close')}></button>
                        </div>
                        <div className="modal-body">
                            <p id={`${id}_desc`}></p>
                            <div className="mb-1">
                                <label htmlFor={inputId} className="form-label text-lighter">{this.props.input.title}</label>
                                {this.getInputElement(inputId)}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">{t('close')}</button>
                            <button type="button" id={`${id}_submit`} className="btn btn-primary">{t('continue')}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    getInputElement(inputId: string): JSX.Element | undefined {
        switch (this.props.input.type) {
            case 'directory':
                const btnId = `${inputId}_btn`;
                return (
                    <div className="input-group mb-1 custom-input-wrapper">
                        <input type="text" className="form-control custom-input text-lighter" id={inputId} placeholder={`${this.props.input.title}...`} aria-describedby={btnId} />
                        <button id={btnId} className="input-group-text custom-input">{t('install.choose_dir')}</button>
                    </div>
                );
            default:
                return undefined;
        }
    }

    componentDidMount() {
        const id = `inmod_${this.props.input.id}`
        const desc = document.getElementById(`${id}_desc`);
        if (desc) desc.innerHTML = this.props.input.description;

        const input = document.getElementById(`${id}_in`);
        if (input && input instanceof HTMLInputElement) {
            if (this.props.input.compiledDefault) input.value = this.props.input.compiledDefault;

            const inputId = `${id}_in`;
            switch (this.props.input.type) {
                case 'directory':
                    const fileSelectorButton = document.getElementById(`${inputId}_btn`);
                    fileSelectorButton?.addEventListener('click', () => {
                        UTILITIES.chooseFiles({
                            title: t('install.input.choose', this.props.input.title),
                            properties: ['openDirectory', 'promptToCreate', 'dontAddToRecent']
                        }).then(result => {
                            if (!result || result.canceled || !input) return;

                            const paths = result.filePaths;
                            if (paths.length !== 1) throw new Error('Only one file must be chosen');

                            input.value = result.filePaths[0];
                        }).catch(err => ElectronLog.error('Error while choosing file:', err));
                    });
                    break;

                default:
                    break;
            }

            const submitBtn = document.getElementById(`${id}_submit`);
            submitBtn?.addEventListener('click', () => {
                const value = input.value.trim();
                if (value.length <= 0) {
                    alert(`Please input '${this.props.input.title}'!`);
                    return;
                }
                UTILITIES.doesFileExist(value).then(exists => {
                    if (!exists) alert(t('install.dir_does_not_exist'));
                    else {
                        const modal = document.getElementById(id);
                        if (modal) Modal.getInstance(modal)?.hide();
                        this.props.map[this.props.input.id] = value;
                        this.props.next();
                    }
                }).catch(err => ElectronLog.error('Failed to check if directory exists:', err));
            });
        }
    }
}

export default AdditionalInputModal;