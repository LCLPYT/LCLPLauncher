import React, { Component } from 'react';
import { Redirect, RouteComponentProps } from 'react-router-dom';
import App from '../../../../../common/types/App';
import AppPreviewItem from '../../../../../common/types/AppPreviewItem';
import { getBackendHost } from '../../../../../common/utils/settings';

import '../../../../style/pages/library/store_page.scss';
import AppPreview from './AppPreview';
import BuyButton from './BuyButton';
import CollapsableDescription from './CollapsableDescription';
import GenresDisplay from './GenresDisplay';

interface Props extends RouteComponentProps<{ app: string }> {}

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
    previewData?: AppPreviewItem[];
}

class Content extends Component<ContentProps, ContentState> {
    constructor(props: ContentProps) {
        super(props);
        this.state = {} as ContentState;
        this.fetchPreview();
    }

    render() {
        const isAppFree = this.props.app.cost !== undefined && this.props.app.cost <= 0.00;
        if (this.state.redirectTo) return <Redirect push to={this.state.redirectTo} />;

        return (
            <div className="container p-3">
                <h2 className="text-lighter">{this.props.app.title}</h2>
                {this.props.app.description ? <CollapsableDescription content={this.props.app.description} /> : undefined}
                <GenresDisplay values={this.props.app.genres} />
                {this.state.previewData ? <AppPreview app={this.props.app} previewData={this.state.previewData} /> : undefined}
                <div id="buyArea" className="highlight-area rounded p-4 mt-3 shadow d-flex justify-content-between align-items-center">
                    <div className="play-title flex-grow-1">
                        {isAppFree ? `Play ${this.props.app.title}` : `Buy ${this.props.app.title}`}
                    </div>
                    <BuyButton app={this.props.app} onClick={() => this.setState({ redirectTo: '/library' })} />
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
        const buyArea = document.getElementById('buyArea');

        function onResize() {
            // Buy button offset
            const buyBtn = document.getElementById('buyBtn');
            if (buyArea && buyBtn) buyBtn.style.top = `${Math.floor(buyArea.getBoundingClientRect().height / 2 - buyBtn.getBoundingClientRect().height / 4).toFixed(0)}px`;
        }

        onResize();

        window.addEventListener('resize', () => onResize());
    }

    fetchPreview() {
        fetch(`http://localhost:8000/api/lclplauncher/app-preview/${this.props.app.key}`)
            .then(response => response.json())
            .then(data => this.setState({ previewData: data as AppPreviewItem[] }))
            .catch(reason => console.error('Failed to fetch preview:', reason));
    }
}

export default AppStorePage;