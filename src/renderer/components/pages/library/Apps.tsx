import React, { Component } from 'react';
import App from '../../../../common/types/App';
import { getBackendHost } from '../../../../common/utils/settings';
import { LIBRARY } from '../../../utils/ipc';

import '../../../style/pages/library/library.scss';
import tippy from 'tippy.js';
import { Link } from 'react-router-dom';

interface State {
    apps?: App[]
}

class Apps extends Component<{}, State> {
    constructor(props: {}) {
        super(props);
        this.state = {} as State;
        this.fetchLibraryApps();
    }

    render() {
        return this.state.apps ? React.createElement(Content, {
            apps: this.state.apps
        } as ContentProps) : <Loading />
    }

    fetchLibraryApps() {
        LIBRARY.getLibraryApps()
            .then(apps => this.setState({ apps: apps }))
            .catch(err => console.error('Could not fetch library apps:', err));
    }
}

class Loading extends Component {
    render() {
        return (
            <div className="h-100 w-100 d-flex align-items-center text">
                <div className="spinner-border mx-auto text-lighter" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }
}

interface ContentProps {
    apps: App[]
}

class Content extends Component<ContentProps> {
    render() {
        return (
            <div className="container p-3">
                <div className="d-flex align-items-center">
                    <h3 className="text-lighter mb-0 me-2">All Apps</h3>
                    <div className="section-seperator border-top border-lighter flex-fill mt-1" />
                </div>
                <div className="text-light section-desc">Every app you added to your library is shown here.</div>
                <div className="row row-cols-auto mt-3">
                    {this.props.apps.map(app => <AppEntry key={app.id} app={app} />)}
                </div>
            </div>
        );
    }
}

class AppEntry extends Component<{ app: App }> {
    render() {
        return (
            <div className="col pb-2 px-2">
                <Link to={`/library/app/${this.props.app.key}`}>
                    <div id={`card${this.props.app.id}`} className="text-center d-inline-block cursor-pointer card-wrapper overflow-hidden">
                        <div className="card-banner-wrapper rounded shadow">
                            <img className="card-banner" src={`${getBackendHost()}/api/lclplauncher/apps/assets/card-banner/${this.props.app.key}`} alt="App banner" />
                        </div>
                        <div className="card-overlay-bottom p-2 text-lighter d-flex align-items-center">
                            <div className="flex-fill text-start ps-2">{this.props.app.title}</div>
                            <span className="material-icons overlay-arrow">chevron_right</span>
                        </div>
                    </div>
                </Link>
            </div>
        );
    }

    componentDidMount() {
        const wrapper = document.getElementById(`card${this.props.app.id}`);
        if (wrapper) {
            const overlay = wrapper.querySelector('.card-overlay-bottom');
            if (overlay) {
                wrapper.addEventListener('mouseenter', () => overlay.classList.add('wrapper-hover'));
                wrapper.addEventListener('mouseleave', () => overlay.classList.remove('wrapper-hover'));

                const arrow = overlay.querySelector('.overlay-arrow');
                if (arrow) tippy(arrow, {
                    content: 'View app',
                    animation: 'scale'
                });
            }
        }
    }
}

export default Apps;