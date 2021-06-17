import React, { Component } from 'react';
import { Switch, Route, NavLink, Redirect } from 'react-router-dom';
import Apps from './library/Apps';
import Search from './library/Search';

import '../../style/pages/library.css';

class Library extends Component {
    render() {
        return (
            <>
                <div id="libraryContainer">
                    <div id="librarySidebar" className="separator-border-dark-right">
                        <div className="tab-btn mb-1">
                            <NavLink to="/library/apps" className="navigation-link-color no-underline" activeClassName="navigation-link-color-active">
                                <span className="material-icons tab-icon">apps</span>
                                <div className="tab-desc">Apps</div>
                            </NavLink>
                        </div>
                        <div className="tab-btn">
                            <NavLink to="/library/search" className="navigation-link-color no-underline" activeClassName="navigation-link-color-active">
                                <span className="material-icons tab-icon">search</span>
                                <div className="tab-desc">Search</div>
                            </NavLink>
                        </div>
                    </div>
                    <div id="libraryContent" className="pt-3 ps-3">
                        <Switch>
                            <Route exact path="/library" render={() => (<Redirect to="/library/apps" />)} />
                            <Route exact path="/library/apps" component={ Apps } />
                            <Route exact path="/library/search" component={ Search } />
                        </Switch>
                    </div>
                </div>
            </>
        );
    }
}

export default Library;