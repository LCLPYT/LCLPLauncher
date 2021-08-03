import React, { Component } from 'react';
import { Redirect, RouteComponentProps } from 'react-router-dom';
import App from '../../../../../common/types/App';
import AppPreviewItem from '../../../../../common/types/AppPreviewItem';
import { getBackendHost } from '../../../../../common/utils/settings';

import '../../../../style/pages/library/store_page.scss';
import LoadingSpinner from '../../../utility/LoadingSpinner';
import AppPreview from './AppPreview';
import BuyButton from './BuyButton';
import CollapsableDescription from '../../../utility/CollapsableDescription';
import GenresDisplay from '../../../utility/GenresDisplay';

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
                <LoadingSpinner />
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
                <div className="d-flex rounded shadow mt-2" id="appPreviewContainer">
                  <div className="w-50">
                      {this.state.previewData ? <AppPreview app={this.props.app} previewData={this.state.previewData} /> : undefined}
                  </div>
                  <div className="w-50 p-3 overflow-auto custom-scrollbar" id="previewContainerRight">
                      {this.props.app.description ? <CollapsableDescription content={this.props.app.description} /> : undefined}
                      <div className="pt-2 border-top border-secondary">
                          <GenresDisplay values={this.props.app.genres} />
                      </div>
                  </div>
                </div>
                <div id="buyArea" className="highlight-area rounded p-4 mt-4 shadow d-flex justify-content-between align-items-center">
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
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        // Buy button offset
        const buyArea = document.getElementById('buyArea');
        const buyBtn = document.getElementById('buyBtn');
        if (buyArea && buyBtn) buyBtn.style.top = `${Math.floor(buyArea.getBoundingClientRect().height / 2 - buyBtn.getBoundingClientRect().height / 4).toFixed(0)}px`;

        // max height of right container part
        const appPreviewCarousel =  document.getElementById('appPreviewCarousel');
        const previewContainerRight = document.getElementById('previewContainerRight');
        if(appPreviewCarousel && previewContainerRight) previewContainerRight.style.maxHeight = `${appPreviewCarousel.getBoundingClientRect().height}px`;
    }

    fetchPreview() {
        fetch(`${getBackendHost()}/api/lclplauncher/app-preview/${this.props.app.key}`)
            .then(response => response.json())
            .then(data => this.setState({ previewData: data as AppPreviewItem[] }))
            .catch(reason => console.error('Failed to fetch preview:', reason));
    }

    componentDidUpdate() {
        this.onResize();
    }
}

export default AppStorePage;