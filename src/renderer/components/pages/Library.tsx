import React, { Component } from 'react';
import { Switch, Route, NavLink, Redirect, RouteComponentProps } from 'react-router-dom';
import Apps from './library/Apps';
import Search from './library/Search';

import '../../style/pages/library.scss';
import AppStorePage from './library/store/AppStorePage';
import { getBackendHost } from '../../../common/utils/settings';
import AppPage from './library/AppPage';
import { translate as t } from '../../../common/utils/i18n';

class Library extends Component {
    render() {
        return (
            <>
                <div id="libraryContainer">
                    <div id="librarySidebar" className="ui-separator-right bg-dark">
                        <div className="py-1">
                            <SideTab route="/library/apps" icon="apps" title={t('page.library.side.apps')} />
                            <SideTab route="/library/search" icon="search" title={t('page.library.side.search')} />
                        </div>
                        <Route exact path="/library/store/app/:app" render={props => (
                            <div className="py-1 separator-border-dark-top">
                                {
                                    React.createElement(SideAppTab, {
                                        link: `/library/store/app/${props.match.params.app}`,
                                        title: t('page.library.side.store'),
                                        ...props
                                    } as SideAppTabProps)
                                }
                            </div>
                        )} />
                        <Route exact path="/library/app/:app" render={props => (
                            <div className="py-1 ui-separator-top">
                                {
                                    React.createElement(SideAppTab, {
                                        link: `/library/app/${props.match.params.app}`,
                                        title: undefined,
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
                            <Route exact path="/library/app/:app" component={AppPage} />
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
}

class SideTab extends Component<SideTabProps> {
    render() {
        return (
            <NavLink to={this.props.route} className="navigation-link-color-dimmed no-underline cursor-pointer no-focus-visible" activeClassName="active">
                <div className="tab-btn py-1 sub-inner-focus">
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
            <NavLink to={this.props.link} className="navigation-link-color-dimmed no-underline no-focus-visible" activeClassName="active">
                <div className="tab-btn py-1 sub-inner-focus">
                    <img src={`${getBackendHost()}/api/lclplauncher/apps/assets/app-icon/${this.props.match.params.app}`} className="tab-img" alt="App icon" />
                    {
                        this.props.title ? (<div className="tab-desc-less">{this.props.title}</div>) : undefined
                    }
                </div>
            </NavLink>
        );
    }
}

export default Library;