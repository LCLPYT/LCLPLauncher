import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { App } from '../../../../../common/library/app';
import { getBackendHost } from '../../../../../common/settings';

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
        return (
            <div className="container p-3">
                <h2>{this.props.app.title}</h2>
                Loaded
            </div>
        );
    }
}

export default AppStorePage;