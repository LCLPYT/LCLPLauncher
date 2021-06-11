import React, { Component } from 'react';
import { HashRouter, Switch, Route } from 'react-router-dom';
import Menubar from './Menubar';
import Home from './pages/Home';
import Library from './pages/Library';

class App extends Component {
    render() {
        return (
            <HashRouter>
                <Menubar/>
                <Switch>
                    <Route exact path="/" component={ Home }></Route>
                    <Route exact path="/one" component={ Library }></Route>
                </Switch>
            </HashRouter>
        );
    }
}

export default App;