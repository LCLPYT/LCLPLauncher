import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';

interface MatchParams {
    app: string;
}

interface Props extends RouteComponentProps<MatchParams> {}

class AppStorePage extends Component<Props> {
    render() {
        return (
            <div className="container p-3">
                <h2 className="text-lighter">Store page for "{this.props.match.params.app}"</h2>
            </div>
        );
    }
}

export default AppStorePage;