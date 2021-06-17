import React, { Component } from 'react';
import { HashRouter, Switch, Route, Redirect } from 'react-router-dom';
import Menubar from './Menubar';
import Home from './pages/Home';
import Library from './pages/Library';
import Settings from './pages/Settings';

class App extends Component {

    render() {
        return (
            <HashRouter>
                <Menubar/>
                <div id="pageContent">
                    <Switch>
                        <Route exact path="/" render={() => (<Redirect to="/home" />)} />
                        <Route exact path="/home" component={ Home } />
                        <Route exact path="/library" component={ Library } />
                        <Route exact path="/settings" component={ Settings } />
                    </Switch>
                </div>
            </HashRouter>
        );
    }
}

export default App;