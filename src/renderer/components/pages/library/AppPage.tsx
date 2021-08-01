import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import App from '../../../../common/types/App';
import { getBackendHost } from '../../../../common/utils/settings';
import LoadingSpinner from '../../utility/LoadingSpinner';

import '../../../style/pages/library/app_page.scss';

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

class Content extends Component<ContentProps> {
    render() {
        return (
            <div id="appWrapper">
                <div id="appBackground">
                    <img src={`${getBackendHost()}/api/lclplauncher/apps/assets/page-banner/${this.props.app.key}`} alt="Page banner" className="w-100" />
                </div>
                <div id="appForeground">
                    <h1>{this.props.app.title}</h1>
                    <div className="foreground-container">
                    </div>
                </div>
            </div>
        );
    }
    componentDidMount() {
        this.onResize();

        window.addEventListener('resize', () => this.onResize());
    }

    onResize() {
        const libraryContent = document.getElementById('libraryContent');
        const appWrapper = document.getElementById('appWrapper');
        const appBackground = document.getElementById('appBackground');

        if(libraryContent && appWrapper && appBackground) {
            const libContentHeight = libraryContent.getBoundingClientRect().height;
            const backgroundHeight = appBackground.getBoundingClientRect().height;
            appWrapper.style.minHeight = `${backgroundHeight > libContentHeight ? backgroundHeight : libContentHeight}px`;
        }
    }
}

export default AppPage;