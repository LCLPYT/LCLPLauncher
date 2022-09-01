import React, { Component } from 'react';
import App from '../../../../common/types/App';
import { getBackendHost } from '../../../../common/utils/settings';
import { LIBRARY } from '../../../utils/ipc';

import '../../../style/pages/library/library.scss';
import tippy from 'tippy.js';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../utility/LoadingSpinner';

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
                <LoadingSpinner />
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
            <div id="appsContainer" className="container hmin-100">
                <div id="appsFlexContainer" className="pt-3 d-flex flex-column">
                    <div className="d-flex align-items-center">
                        <h3 className="text-lighter mb-0 me-2">Your apps</h3>
                    </div>
                    <div className="text-light section-desc">Every app you added to your library is shown here.</div>
                    {this.props.apps.length <= 0 ? (
                        <div className="d-flex flex-grow-1">
                            <div className="w-100 align-self-center mb-5">
                                <div className="text-center text-muted centered-info">Looks like you haven't added any apps yet.</div>
                                <div className="text-center mt-2">
                                    <Link to="/library/search" className="btn btn-secondary text-light cursor-pointer shadow-sm" role="button">
                                        <div className="d-flex align-items-center">
                                            <span className="material-icons me-2">search</span>
                                            <span>Search apps</span>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="row row-cols-auto mt-3">
                            {this.props.apps.map(app => <AppEntry key={app.id} app={app} />)}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    protected resizeListener?: () => void;

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener = () => this.onResize());
        this.onResize();
    }

    componentWillUnmount() {
        if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
    }

    onResize() {
        const appsContainer = document.getElementById('appsContainer');
        const appsFlexContainer = document.getElementById('appsFlexContainer');

        if (appsContainer && appsFlexContainer) {
            appsFlexContainer.style.minHeight = '';
            appsFlexContainer.style.minHeight = `${appsContainer.getBoundingClientRect().height}px`;
        }
    }
}

class AppEntry extends Component<{ app: App }> {
    render() {
        return (
            <div className="col pb-2 px-2">
                <Link to={`/library/app/${this.props.app.key}`}>
                    <div id={`card${this.props.app.id}`} className="text-center d-inline-block cursor-pointer card-wrapper overflow-hidden shadow">
                        <div className="card-banner-wrapper rounded">
                            <img className="card-banner" src={`${getBackendHost()}/api/lclplauncher/apps/assets/card-banner/${this.props.app.key}`} alt="App banner" />
                        </div>
                        <div className="card-overlay-bottom p-2 d-flex align-items-center">
                            <div id={`appName${this.props.app.id}`} className="flex-fill text-start ps-2 library-app-name">{this.props.app.title}</div>
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
            const img = wrapper.querySelector('.card-banner');
            if (overlay) {
                wrapper.addEventListener('mouseenter', () => {
                    overlay.classList.add('wrapper-hover');
                    img?.classList.add('active');
                });
                wrapper.addEventListener('mouseleave', () => {
                    overlay.classList.remove('wrapper-hover');
                    img?.classList.remove('active');
                });

                const arrow = overlay.querySelector('.overlay-arrow');
                if (arrow) tippy(arrow, {
                    content: 'View app',
                    animation: 'scale'
                });
            }
        }

        const name = document.getElementById(`appName${this.props.app.id}`);
        if (name) {
            const onResize = () => {
                if (name.getBoundingClientRect().height > 24) {
                    const parent = name.parentElement;
                    if (parent) {
                        parent.classList.add('py-3');
                    }
                }
            };
            window.addEventListener('resize', () => onResize());
            onResize();
        }
    }
}

export default Apps;