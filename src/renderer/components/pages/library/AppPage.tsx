import React, { Component } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import App from '../../../../common/types/App';
import { getBackendHost } from '../../../../common/utils/settings';
import LoadingSpinner from '../../utility/LoadingSpinner';

import '../../../style/pages/library/app_page.scss';
import tippy from 'tippy.js';
import CollapsableDescription from '../../utility/CollapsableDescription';
import GenresDisplay from '../../utility/GenresDisplay';
import { Modal } from 'bootstrap';
import PlayStateButton from './page/PlayStateButton';
import AppSettingsModal from './page/AppSettingsModal';
import InstallationOptionsModal from './page/InstallationOptionsModal';
import DependenciesAlertModal from './page/DependenciesAlertModal';
import AppFeed from './page/AppFeed';
import { goToHome } from '../../../utils/router';

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
                goToHome();
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
    currentDialog?: JSX.Element,
    currentDialogId?: string
}

class Content extends Component<ContentProps, ContentState> {
    protected feedRef: React.RefObject<AppFeed>;

    constructor(props: ContentProps) {
        super(props);
        this.state = {};
        this.loadTitleImage();
        this.feedRef = React.createRef();
    }

    render() {
        return (
            <div id="appWrapper">
                <div id="appBackground" className="parallax w-100" data-parallax-speed="0.4">
                    <img src={`${getBackendHost()}/api/lclplauncher/apps/assets/page-banner/${this.props.app.key}`} alt="Page banner" className="w-100" />
                </div>
                <div id="appForeground">
                    <div>
                        {this.state.titleBranding ? <img src={this.state.titleBranding} alt={this.props.app.title} className="app-title-branding p-1" /> : <h1 className="app-title px-3">{this.props.app.title}</h1>}
                    </div>
                    <div className="foreground-container separator-border-dark-top">
                        <div id="playBar" className="px-4 d-flex align-items-center text-lighter separator-border-dark-bottom sticky-top">
                            <PlayStateButton app={this.props.app} currentDialogSetter={(dialogId, dialog) => this.setCurrentDialog(dialogId, dialog)} />
                            <Link id="shopPageLink" to={`/library/store/app/${this.props.app.key}`} className="d-flex align-items-center navigation-link-color-dimmed no-underline cursor-pointer">
                                <span className="material-icons">shopping_bag</span>
                            </Link>
                            <span id="appSettingsLink" className="material-icons ms-2 navigation-link-color-dimmed cursor-pointer">settings</span>
                        </div>
                        <div className="d-flex">
                            <AppFeed ref={this.feedRef} app={this.props.app} />
                            <div id="appDetails" className="px-3">
                                <h4 className="text-lighter mb-1">{this.props.app.title}</h4>
                                {this.props.app.description ? <CollapsableDescription id="appDesc" content={this.props.app.description} /> : undefined}
                                <GenresDisplay values={this.props.app.genres} theme="dark" />
                            </div>
                        </div>
                    </div>
                </div>
                <InstallationOptionsModal app={this.props.app} />
                <AppSettingsModal app={this.props.app} />
                <DependenciesAlertModal app={this.props.app} />
                {this.state.currentDialog ? this.state.currentDialog : undefined}
            </div>
        );
    }

    setCurrentDialog(dialogId: string, dialog: JSX.Element | undefined) {
        this.setState({
            currentDialogId: dialogId,
            currentDialog: dialog
        });
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

        const appSettingsLink = document.getElementById('appSettingsLink');
        if (appSettingsLink) {
            tippy(appSettingsLink, {
                'content': 'App settings',
                'animation': 'scale'
            });

            const appSettingsModalElement = document.getElementById('appSettingsModal');
            if (appSettingsModalElement) {
                appSettingsLink.addEventListener('click', () => {
                    let instance = Modal.getInstance(appSettingsModalElement);
                    if (!instance) instance = new Modal(appSettingsModalElement);
                    instance.show();
                });
            }
        }
    }

    componentDidUpdate(_prevProps: ContentProps, prevState: ContentState) {
        this.onResize();
        if (this.state.currentDialog !== prevState.currentDialog && this.state.currentDialogId) {
            const modal = document.getElementById(this.state.currentDialogId);
            if (modal) new Modal(modal).show();
        }
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

        if (this.feedRef.current && !this.feedRef.current.wasEndReached()) {
            const lastElement = this.feedRef.current.getLastElement();
            if (lastElement) {
                const rect = lastElement.getBoundingClientRect();
                if (rect.top >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)) { // if lastElement is in viewport
                    this.feedRef.current.loadNextPage();
                }
            }
        }
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

export default AppPage;