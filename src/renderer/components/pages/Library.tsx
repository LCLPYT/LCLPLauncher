import React, { Component } from 'react';
import { Switch, Route, NavLink, Redirect, RouteComponentProps } from 'react-router-dom';
import Apps from './library/Apps';
import Search from './library/Search';

import '../../style/pages/library.scss';
import AppStorePage from './library/store/AppStorePage';
import { getBackendHost } from '../../../common/utils/settings';

class Library extends Component {
    render() {
        return (
            <>
                <div id="libraryContainer">
                    <div id="librarySidebar" className="separator-border-dark-right">
                        <div className="sidebar-padding">
                            <SideTab route="/library/apps" icon="apps" title="Apps" />
                            <SideTab route="/library/search" icon="search" title="Search" />
                        </div>
                        <Route exact path="/library/store/app/:app" render={props => (
                            <div className="py-1 separator-border-dark-top">
                                {
                                    React.createElement(SideAppTab, {
                                        link: `/library/store/app/${props.match.params.app}`,
                                        title: 'Store',
                                        ...props
                                    } as SideAppTabProps)
                                }
                            </div>
                        )} />
                    </div>
                    <div id="libraryContent">
                        <Switch>
                            <Route exact path="/library" render={() => (<Redirect to="/library/apps" />)} />
                            <Route exact path="/library/apps" component={Apps} />
                            <Route exact path="/library/search" component={Search} />
                            <Route exact path="/library/store/app/:app" component={AppStorePage} />
                            <Route exact path="/library/app/:app" component={AppStorePage} />
                        </Switch>
                    </div>
                </div>
            </>
        );
    }
}

interface SideTabProps {
    icon: string,
    title: string,
    route: string
};

class SideTab extends Component<SideTabProps> {
    render() {
        return (
            <NavLink to={this.props.route} className="navigation-link-color-dimmed no-underline cursor-pointer" activeClassName="active">
                <div className="tab-btn py-1">
                    <span className="material-icons tab-icon">{this.props.icon}</span>
                    <div className="tab-desc">{this.props.title}</div>
                </div>
            </NavLink>
        );
    }
}

interface MatchParams {
    app: string;
}

interface SideAppTabProps extends RouteComponentProps<MatchParams> {
    link: string,
    title?: string,
}

class SideAppTab extends Component<SideAppTabProps> {
    render() {
        return (
            <NavLink to={this.props.link} className="navigation-link-color-dimmed no-underline" activeClassName="active">
                <div className="tab-btn py-1">
                    <img src={`${getBackendHost()}/api/lclplauncher/apps/assets/app-icon/${this.props.match.params.app}`} className={this.props.title ? 'tab-img-sm' : 'tab-img'} alt="App icon" />
                    {
                        this.props.title ? (<div className="tab-desc-less">{this.props.title}</div>) : undefined
                    }
                </div>
            </NavLink>
        );
    }
}

export default Library;