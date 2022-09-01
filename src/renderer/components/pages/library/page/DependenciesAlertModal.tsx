import { Modal } from "bootstrap";
import React, { Component } from "react";
import App from "../../../../../common/types/App";
import AppDependency from "../../../../../common/types/AppDependency";
import { DependenciesEvent, dependenciesManager } from "../../../../event/dependencies";

interface Props {
    app: App
}

interface State {
    dependencies?: AppDependency[],
    show?: boolean,
    callback?: () => void
}

class DependenciesAlertModal extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <div className="modal fade" id="dependenciesModal" tabIndex={-1} aria-labelledby="dependenciesModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title text-lighter" id="dependenciesModalLabel">Required dependencies</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body by-1 text-lighter custom-scrollbar">
                            <div><span className="fw-bold">{this.props.app.title}</span> requires additional dependencies:</div>
                            <table className="table table-dark table-sm mt-2">
                                <thead>
                                    <tr>
                                        <th scope="col">Dependency</th>
                                        <th scope="col">Version</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        this.state.dependencies?.map((dependency, index) => <DependencyRow key={`row${index}`} dependency={dependency} />)
                                    }
                                </tbody>
                            </table>
                            <div>Do you consent to download each of the listed packages on your own behalf?</div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" id="dependencyInstallBtn" className="btn btn-primary">I consent</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    protected progressListeners: {
        [type: string]: (event: DependenciesEvent) => void
    } = {};
    protected dependencyInstallListener?: () => void;

    componentDidMount() {
        dependenciesManager.addEventListener('set-dependencies', this.progressListeners['set-dependencies'] = event => {
            if (!event.detail.dependencies) throw new Error('Dependencies detail does not exist');
            this.setState({
                dependencies: event.detail.dependencies,
                show: event.detail.show,
                callback: event.detail.callback
            });
        });

        const dependencyInstallBtn = document.getElementById('dependencyInstallBtn');
        if (dependencyInstallBtn) {
            dependencyInstallBtn.addEventListener('click', this.dependencyInstallListener = () => {
                if (this.state.callback) this.state.callback();
                this.getModal()?.hide();
            });
        }

        this.update();
    }

    componentWillUnmount() {
        Object.entries(this.progressListeners).forEach(([type, listener]) => {
            dependenciesManager.removeEventListener(type, listener)
        });
        if (this.dependencyInstallListener) {
            const dependencyInstallBtn = document.getElementById('dependencyInstallBtn');
            dependencyInstallBtn?.removeEventListener('click', this.dependencyInstallListener);
        }
    }

    componentDidUpdate() {
        this.update();
    }

    getModal() {
        const modalElement = document.getElementById('dependenciesModal');
        if (modalElement) {
            const modalInstance = Modal.getInstance(modalElement);
            return modalInstance ? modalInstance : new Modal(modalElement);
        } else return null;
    }

    update() {
        if (!!this.state.show) this.getModal()?.show();
    }
}

class DependencyRow extends Component<{ dependency: AppDependency }> {
    render() {
        return (
            <tr>
                <td>{this.props.dependency.name}</td>
                <td>{this.props.dependency.version}</td>
            </tr>
        );
    }
}

export default DependenciesAlertModal;