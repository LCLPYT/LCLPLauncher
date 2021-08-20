import { Toast } from 'bootstrap';
import React, { Component } from 'react';
import { HashRouter, Redirect, Route, Switch } from 'react-router-dom';
import Menubar from './Menubar';
import Home from './pages/Home';
import Library from './pages/Library';
import Settings from './pages/Settings';

class App extends Component {
    render() {
        return (
            <HashRouter>
                <Menubar />
                <div id="pageContent" className="custom-scrollbar">
                    <Switch>
                        <Route exact path="/" render={() => (<Redirect to="/home" />)} />
                        <Route exact path="/home" component={Home} />
                        <Route path="/library" component={Library} />
                        <Route exact path="/settings" component={Settings} />
                    </Switch>
                </div>
                <ToastStack />
            </HashRouter >
        );
    }

    protected resizeListener?: () => void;

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener = () => this.onResize());
        this.onResize();
    }

    componentWillUnmount() {
        if (this.resizeListener) window.removeEventListener('resize', this.resizeListener);
    }

    onResize() {
        const pageContent = document.getElementById('pageContent');
        const toastWrapper = document.getElementById('toastWrapper');
        if (pageContent && toastWrapper) {
            toastWrapper.style.width = `${pageContent.getBoundingClientRect().width}px`;
            toastWrapper.style.height = `${pageContent.getBoundingClientRect().height}px`;
            toastWrapper.style.left = `${pageContent.getBoundingClientRect().x}px`;
            toastWrapper.style.top = `${pageContent.getBoundingClientRect().y}px`;
        }
    }
}

class ToastStack extends Component {
    render() {
        return (
            <div className="toast-container" id="toastContainer">
                <div className="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="false">
                    <div className="toast-header">
                        {/* <img src="..." className="rounded me-2" alt="..." /> */}
                        <span className="material-icons toast-icon text-light">file_download</span>
                        <strong className="ms-1 me-auto text-light">Downloads active</strong>
                        <small className="text-muted">2 seconds ago</small>
                        <button type="button" className="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div className="toast-body pt-1 text-lighter">
                        <div className="d-flex align-items-center text-lighter">
                            <div className="fw-bold flex-fill">LCLPServer 5.0</div>
                            <div>75%</div>
                        </div>
                        <div className="progress toast-progress">
                            <div className="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" aria-valuenow={75} aria-valuemin={0} aria-valuemax={100} style={{width: '75%'}}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    componentDidMount() {
        const toastElements = document.querySelectorAll('.toast');
        Array.from(toastElements).forEach(element => new Toast(element).show());
    }
}

export default App;