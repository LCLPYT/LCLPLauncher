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
import { DOWNLOADER } from '../../../utils/ipc';

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
                            <button id="playBtn" className="px-4 btn btn-lg btn-primary">Install</button>
                            <div id="playDesc" className="ms-3 flex-fill">Not yet installed.</div>
                            <Link id="shopPageLink" to={`/library/store/app/${this.props.app.key}`} className="d-flex align-items-center navigation-link-color-dimmed no-underline">
                                <span className="material-icons">shopping_bag</span>
                            </Link>
                        </div>
                        <div className="d-flex">
                            <div id="appFeed" className="flex-fill px-4 py-3">
                                <h4 className="text-lighter">Feed</h4>
                                <YouTube videoId="q_KytDRIODU" className="shadow feed-yt" />
                            </div>
                            <div id="appDetails" className="py-2 px-3 shadow">
                                <h4 className="text-lighter mb-1">{this.props.app.title}</h4>
                                {this.props.app.description ? <CollapsableDescription content={this.props.app.description} /> : undefined}
                                <GenresDisplay values={this.props.app.genres} theme="dark" />
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
        if(shopPageLink) tippy(shopPageLink, {
            'content': 'Visit store page',
            'animation': 'scale'
        });

        const playBtn = document.getElementById('playBtn');
        playBtn?.addEventListener('click', () => {
            console.info(`Starting installation process of '${this.props.app.title}'...`);
            DOWNLOADER.startInstallationProcess(this.props.app)
                .then(success => {
                    if(success === null) return; // Button clicked while installation process is running
                    if(success) console.info(`Installation of '${this.props.app.title}' has finished successfully.`);
                    else console.error(`Could not complete installation process of '${this.props.app.title}'.`);
                })
                .catch(error => console.error('Could not finish the installation process:', error));
        });
    }

    componentDidUpdate() {
        this.onResize();
    }

    componentWillUnmount() {
        if(this.scrollListener) {
            const pageContent = document.getElementById('pageContent');
            pageContent?.removeEventListener('scroll', this.scrollListener);
        }
    }

    loadTitleImage() {
        const img = new Image();
        const src = `${getBackendHost()}/api/lclplauncher/apps/assets/title-branding/${this.props.app.key}`;
        img.addEventListener('load', () => this.setState({titleBranding: src}));
        img.src = src;
    }

    ticking: boolean = false;
    scrollY: number = 0;

    onScroll() {
        const container = document.getElementById('pageContent');
        if(!container) return;

        this.scrollY = container.scrollTop;
        if(!this.ticking) {
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
            if(!(element instanceof HTMLElement) || !element.hasAttribute('data-parallax-speed')) return;
            const speed = Number(element.getAttribute('data-parallax-speed'));
            element.style.transform = `translateY(${this.scrollY * speed}px)`;
            this.onResize();
        });
    }

    onResize() {
        const libraryContent = document.getElementById('libraryContent');
        const appWrapper = document.getElementById('appWrapper');
        const appBackground = document.getElementById('appBackground');

        if(libraryContent && appWrapper && appBackground) {
            const libContentHeight = libraryContent.getBoundingClientRect().height;
            let parallaxOffset = 0;
            if(appBackground.style.transform) {
                const translateY = appBackground.style.transform;
                const match = translateY.match(/^translateY\(([0-9.]+)px\)$/);
                if(match) parallaxOffset = Number(match[1]);
            }
            const backgroundHeight = appBackground.getBoundingClientRect().height + parallaxOffset;
            appWrapper.style.minHeight = `${backgroundHeight > libContentHeight ? backgroundHeight : libContentHeight}px`;
        }

        const appTitleBranding = document.querySelector('.app-title-branding');
        if(appTitleBranding) (appTitleBranding as HTMLElement).style.marginTop = `-${appTitleBranding.getBoundingClientRect().height}px`;
    }
}

export default AppPage;