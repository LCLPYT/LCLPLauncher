import React, { Component } from 'react';
import { Redirect, RouteComponentProps } from 'react-router-dom';
import App from '../../../../../common/types/App';
import { getBackendHost } from '../../../../../common/utils/settings';

import '../../../../style/pages/library/store_page.scss';
import { LIBRARY } from '../../../../utils/ipc';

interface MatchParams {
    app: string;
}

interface Props extends RouteComponentProps<MatchParams> { }

interface State {
    data?: App
}

class AppStorePage extends Component<Props, State> {
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
                <div className="spinner-border mx-auto text-lighter" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }
}

interface ContentProps {
    app: App
}

interface ContentState {
    redirectTo?: string;
}

class Content extends Component<ContentProps, ContentState> {
    constructor(props: ContentProps) {
        super(props);
        this.state = {} as ContentState;
    }

    render() {
        const isAppFree = this.props.app.cost !== undefined && this.props.app.cost <= 0.00;
        if(this.state.redirectTo) return <Redirect push to={this.state.redirectTo} />;
        return (
            <div className="container p-3">
                <h2 className="text-lighter">{this.props.app.title}</h2>
                <p id="descriptionDummy" hidden>{this.props.app.description}</p>
                <p className="collapse text-lighter" id="description" aria-expanded="false">{this.props.app.description}</p>
                <div className="text-center">
                    <button className="btn btn-sm btn-primary mb-2" id="descToggler" type="button" data-bs-toggle="collapse" data-bs-target="#description" aria-expanded="false" aria-controls="description" hidden>Show more</button>
                </div>
                <div id="buyArea" className="highlight-area rounded p-4 shadow d-flex justify-content-between align-items-center">
                    <div className="play-title flex-grow-1">
                        {isAppFree ? `Play ${this.props.app.title}` : `Buy ${this.props.app.title}`}
                    </div>
                    <BuyBtn app={this.props.app} onClick={() => this.setState({ redirectTo: '/library' })} />
                    <div className="price">{isAppFree ? 'Free' : this.props.app.cost?.toLocaleString('de-DE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                        style: 'currency',
                        currency: 'EUR'
                    })}</div>
                </div>
            </div>
        );
    }
    componentDidMount() {
        const desc = document.getElementById('description');
        const descDummy = document.getElementById('descriptionDummy');
        const descToggler = document.getElementById('descToggler');
        const buyArea = document.getElementById('buyArea');

        function onResize() {
            // Collapse
            if (desc && descDummy && descToggler) {
                descDummy.hidden = false;
                const descHeight = descDummy.getBoundingClientRect().height;
                descDummy.hidden = true;

                descToggler.hidden = descHeight <= 48;
            }

            // Buy button offset
            const buyBtn = document.getElementById('buyBtn');
            if (buyArea && buyBtn) buyBtn.style.top = `${Math.floor(buyArea.getBoundingClientRect().height / 2 - buyBtn.getBoundingClientRect().height / 4).toFixed(0)}px`;
        }

        onResize();

        desc?.addEventListener('show.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = 'Show less';
        });

        desc?.addEventListener('hide.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = 'Show more';
        });

        window.addEventListener('resize', () => onResize());
    }
}

interface BuyBtnProps {
    app: App,
    onClick: () => void;
}

interface BuyBtnState {
    btnState?: 'loading' | 'added'
}

class BuyBtn extends Component<BuyBtnProps, BuyBtnState> {
    constructor(props: BuyBtnProps) {
        super(props);
        this.state = {} as BuyBtnState;
    }
    
    render() {
        const isAppFree = this.props.app.cost !== undefined && this.props.app.cost <= 0.00;
        return (
            <button id="buyBtn" className="buy-btn rounded-pill px-3 py-2 me-5 shadow d-flex align-items-center">
                {
                    this.state.btnState !== undefined ? undefined : <span id="buyBtnText">{isAppFree ? 'Add to library' : 'Add to cart'}</span>
                }
                {
                    !this.state.btnState || this.state.btnState !== 'loading' ? undefined : (
                        <div id="buyBtnLoading" className="d-flex align-items-center">
                            <div className="spinner-border spinner-border-sm" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <div className="ms-2">Loading...</div>
                        </div>
                    )
                }
                {
                    !this.state.btnState || this.state.btnState !== 'added' ? undefined : (
                        <div id="buyBtnChecked" className="d-flex align-items-center">
                            <span className="text-success big-emoji">✔</span>
                            <div className="ms-2">Show in library</div>
                        </div>
                    )
                }
            </button>
        );
    }

    componentDidMount() {
        const buyBtn = document.getElementById('buyBtn');
        buyBtn?.addEventListener('click', () => {
            if(this.state.btnState && this.state.btnState === 'added') {
                this.props.onClick();
                return;
            }

            if (this.props.app.cost && this.props.app.cost > 0) {
                alert('Purchases are not yet implemented.');
                return;
            }

            this.setState({ btnState: 'loading' });

            LIBRARY.addAppToLibrary(this.props.app).then(success => this.setState({ btnState: success ? 'added' : undefined }));
        });

        LIBRARY.isAppInLibrary(this.props.app).then(inLibrary => this.setState({ btnState: inLibrary ? 'added' : undefined }));
    }
}

export default AppStorePage;