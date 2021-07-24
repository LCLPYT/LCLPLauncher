import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { App } from '../../../../../common/library/app';
import { getBackendHost } from '../../../../../common/settings';

import '../../../../style/pages/library/store_page.scss';

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

class Content extends Component<ContentProps> {
    render() {
        // this.props.app.cost = 20.3;
        const isAppFree = this.props.app.cost && this.props.app.cost <= 0.00;
        return (
            <div className="container p-3">
                <h2 className="text-lighter">{this.props.app.title}</h2>
                <p id="descriptionDummy" hidden>{this.props.app.description}</p>
                <p className="collapse text-lighter" id="description" aria-expanded="false">{this.props.app.description}</p>
                <div className="text-center">
                    <button className="btn btn-sm btn-primary" id="descToggler" type="button" data-bs-toggle="collapse" data-bs-target="#description" aria-expanded="false" aria-controls="description" hidden>Show more</button>
                </div>
                <div id="buyArea" className="highlight-area rounded p-4 shadow d-flex justify-content-between align-items-center">
                    <div className="play-title flex-grow-1">
                        { isAppFree ? `Play ${this.props.app.title}` : `Buy ${this.props.app.title}` }
                    </div>
                    <button id="buyBtn" className="buy-btn rounded-pill px-3 py-2 me-5">{isAppFree ? 'Add to library' : 'Add to cart'}</button>
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
        const buyBtn = document.getElementById('buyBtn');

        function onResize() {
            // Collapse
            if (desc && descDummy && descToggler) {
                descDummy.hidden = false;
                const descHeight = descDummy.getBoundingClientRect().height;
                descDummy.hidden = true;

                descToggler.hidden = descHeight <= 48;
            }

            // Buy button offset
            if(buyArea && buyBtn) buyBtn.style.top = `${Math.floor(buyArea.getBoundingClientRect().height / 2).toFixed(0)}px`;
        }

        onResize();

        desc?.addEventListener('show.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = 'Show less'
        });

        desc?.addEventListener('hide.bs.collapse', () => {
            if (descToggler) descToggler.innerHTML = 'Show more'
        });

        window.addEventListener('resize', () => onResize());
    }
}

export default AppStorePage;