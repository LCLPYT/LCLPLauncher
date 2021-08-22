import React, { Component } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import App from '../../../../common/types/App';
import { getBackendHost } from '../../../../common/utils/settings';
import LoadingSpinner from '../../utility/LoadingSpinner';

import '../../../style/pages/library/app_page.scss';
import tippy from 'tippy.js';
import CollapsableDescription from '../../utility/CollapsableDescription';
import GenresDisplay from '../../utility/GenresDisplay';
import YouTube from 'react-youtube';
import { DOWNLOADER, UTILITIES } from '../../../utils/ipc';
import AppState from '../../../../common/types/AppState';
import { Modal } from 'bootstrap';

interface Props extends RouteComponentProps<{ app: string }> { }

interface State {
    data?: App
}

class AppPage extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {} as State;
        this.fetchData();
    }

    render() {
        return this.state.data ? React.createElement(Content, {
            app: this.state.data
        } as ContentProps) : <Loading />
    }

    fetchData() {
        const appKey = this.props.match.params.app
        fetch(`${getBackendHost()}/api/lclplauncher/app/${appKey}`)
            .then(response => response.json())
            .then(data => {
                this.setState({
                    data: data as App
                } as State);
            })
            .catch(reason => {
                console.error('Failed to fetch app data:', reason);
            });
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
    app: App
}

interface ContentState {
    titleBranding?: string;
}

class Content extends Component<ContentProps, ContentState> {
    constructor(props: ContentProps) {
        super(props);
        this.state = {} as ContentState;
        this.loadTitleImage();
    }

    render() {
        return (
            <div id="appWrapper">
                <div id="appBackground" className="parallax" data-parallax-speed="0.3">
                    <img src={`${getBackendHost()}/api/lclplauncher/apps/assets/page-banner/${this.props.app.key}`} alt="Page banner" className="w-100" />
                </div>
                <div id="appForeground">
                    <div>
                        {this.state.titleBranding ? <img src={this.state.titleBranding} alt={this.props.app.title} className="app-title-branding p-1" /> : <h1 className="app-title px-3">{this.props.app.title}</h1>}
                    </div>
                    <div className="foreground-container separator-border-dark-top">
                        <div id="playBar" className="px-4 py-2 d-flex align-items-center text-lighter separator-border-dark-bottom">
                            <PlayStateControl app={this.props.app} />
                            <Link id="shopPageLink" to={`/library/store/app/${this.props.app.key}`} className="d-flex align-items-center navigation-link-color-dimmed no-underline cursor-pointer">
                                <span className="material-icons">shopping_bag</span>
                            </Link>
                        </div>
                        <div className="d-flex">
                            <div id="appFeed" className="flex-fill px-4 py-3">
                                <h4 className="text-lighter">Feed</h4>
                                <YouTube videoId="q_KytDRIODU" className="shadow feed-yt" />
                            </div>
                            <div id="appDetails" className="px-3">
                                <h4 className="text-lighter mb-1">{this.props.app.title}</h4>
                                {this.props.app.description ? <CollapsableDescription content={this.props.app.description} /> : undefined}
                                <GenresDisplay values={this.props.app.genres} theme="dark" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal fade" id="installationOptionsModal" tabIndex={-1} aria-labelledby="installationOptionsModalLabel" aria-hidden="true">
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title text-lighter" id="installationOptionsModalLabel">Install {this.props.app.title}</h5>
                                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-1">
                                    <label htmlFor="installDirInput" className="form-label text-lighter">Installation directory</label>
                                    <div className="input-group mb-1 custom-input-wrapper" aria-describedby="installDirHelp">
                                        <input type="string" className="form-control custom-input text-lighter" id="installDirInput" placeholder="Installation directory..." aria-describedby="fileSelectorButton" />
                                        <button id="fileSelectorButton" className="input-group-text custom-input">Choose folder...</button>
                                    </div>
                                    <div id="installDirHelp" className="form-text">Choose a directory in which LCLPLauncher should install the app into.</div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" id="installBtn" className="btn btn-primary">Install</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    scrollListener?: () => void;

    componentDidMount() {
        this.onResize();

        window.addEventListener('resize', () => this.onResize());

        const pageContent = document.getElementById('pageContent');
        pageContent?.addEventListener('scroll', this.scrollListener = () => this.onScroll());

        const shopPageLink = document.getElementById('shopPageLink');
        if (shopPageLink) tippy(shopPageLink, {
            'content': 'Visit store page',
            'animation': 'scale'
        });

        const installDirInput = document.getElementById('installDirInput');

        DOWNLOADER.getDefaultInstallationDir(this.props.app).then(path => {
            if (path && installDirInput) (installDirInput as HTMLInputElement).value = path;
        }).catch(err => console.error(err));

        const fileSelectorButton = document.getElementById('fileSelectorButton');
        fileSelectorButton?.addEventListener('click', () => {
            UTILITIES.chooseFiles({
                title: 'Choose installation directory',
                properties: ['openDirectory', 'promptToCreate', 'dontAddToRecent']
            }).then(result => {
                if (!result || result.canceled || !installDirInput) return;

                const paths = result.filePaths;
                if (paths.length !== 1) throw new Error('Only one file must be chosen');

                (installDirInput as HTMLInputElement).value = result.filePaths[0];
            }).catch(err => console.error('Error while choosing file:', err));
        });
    }

    componentDidUpdate() {
        this.onResize();
    }

    componentWillUnmount() {
        if (this.scrollListener) {
            const pageContent = document.getElementById('pageContent');
            pageContent?.removeEventListener('scroll', this.scrollListener);
        }

        const overlay = document.querySelector('body div.modal-backdrop.fade.show');
        if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay);
    }

    loadTitleImage() {
        const img = new Image();
        const src = `${getBackendHost()}/api/lclplauncher/apps/assets/title-branding/${this.props.app.key}`;
        img.addEventListener('load', () => this.setState({ titleBranding: src }));
        img.src = src;
    }

    ticking: boolean = false;
    scrollY: number = 0;

    onScroll() {
        const container = document.getElementById('pageContent');
        if (!container) return;

        this.scrollY = container.scrollTop;
        if (!this.ticking) {
            // Throttle scroll event
            requestAnimationFrame(() => {
                this.onScrollFrame();
                this.ticking = false;
            });
        }
    }

    onScrollFrame() {
        // apply parallax logic
        const parallaxElements = Array.from(document.querySelectorAll('.parallax'));
        parallaxElements.forEach(element => {
            if (!(element instanceof HTMLElement) || !element.hasAttribute('data-parallax-speed')) return;
            const speed = Number(element.getAttribute('data-parallax-speed'));
            element.style.transform = `translateY(${this.scrollY * speed}px)`;
            this.onResize();
        });
    }

    onResize() {
        const libraryContent = document.getElementById('libraryContent');
        const appWrapper = document.getElementById('appWrapper');
        const appBackground = document.getElementById('appBackground');

        if (libraryContent && appWrapper && appBackground) {
            const libContentHeight = libraryContent.getBoundingClientRect().height;
            let parallaxOffset = 0;
            if (appBackground.style.transform) {
                const translateY = appBackground.style.transform;
                const match = translateY.match(/^translateY\(([0-9.]+)px\)$/);
                if (match) parallaxOffset = Number(match[1]);
            }
            const backgroundHeight = appBackground.getBoundingClientRect().height + parallaxOffset;
            appWrapper.style.minHeight = `${backgroundHeight > libContentHeight ? backgroundHeight : libContentHeight}px`;
        }

        const appTitleBranding = document.querySelector('.app-title-branding');
        if (appTitleBranding) (appTitleBranding as HTMLElement).style.marginTop = `-${appTitleBranding.getBoundingClientRect().height}px`;
    }
}

interface PlayState {
    state?: AppState
}

class PlayStateControl extends Component<ContentProps, PlayState> {
    constructor(props: ContentProps) {
        super(props);
        this.state = {} as PlayState;
        this.updateStatus();
    }

    render() {
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
                    <button id="playBtn" className="px-4 btn btn-lg btn-success">Play</button>
                    <div id="playDesc" className="ms-3 flex-fill">Ready to play</div>
                </>
            );
            case 'needs-update': return (
                <>
                    <button id="playBtn" className="px-4 btn btn-lg btn-info">Update</button>
                    <div id="playDesc" className="ms-3 flex-fill">Needs to be updated</div>
                </>
            );
            default:
                throw new Error(`Unimplemented state: '${this.state.state}'`);
        }
    }

    updateStatus() {
        DOWNLOADER.getAppStatus(this.props.app).then(state => {
            if (!state) return; // clicked twice
            this.setState({ state: state });
        }).catch(err => console.error('Could not fetch app status:', err));
    }

    componentDidMount() {
        const playBtn = document.getElementById('playBtn');
        playBtn?.addEventListener('click', () => {
            switch (this.state.state) {
                case 'not-installed':
                    this.startInstallationOptions();
                    break;
                case 'needs-update':
                    this.startUpdate();
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
            else if (installationDir !== null) this.startInstallation(installationDir);
        }).catch(err => console.error('Could not fetch installation directory:', err));
    }

    startInstallation(installationDir: string) {
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

export default AppPage;