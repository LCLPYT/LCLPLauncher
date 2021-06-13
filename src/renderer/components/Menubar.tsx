import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import logo from '../img/logo.svg';

class Menubar extends Component {
    render() {
        return (
            <>
                <header id="header" className="sticky-top">
                    <nav className="navbar navbar-expand navbar-dark bg-dark shadow-sm p-1 dragarea separator-border-dark-slim-top">
                        <button className="btn-nostyle navigation-link-color nodragarea" type="button" data-bs-toggle="offcanvas" data-bs-target="#sideMenu" aria-controls="sideMenu">
                            <span className="material-icons" style={{ verticalAlign: 'bottom' }}>menu</span>
                        </button>
                        <ul className="navbar-nav me-auto mb-0 nodragarea">
                            <li className="nav-item mx-1">
                                <Link to="/" className="nav-link">Home</Link>
                            </li>
                            <li className="nav-item mx-1">
                                <Link to="/one" className="nav-link">
                                    Library
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </header>
                <div className="offcanvas offcanvas-start" tabIndex={-1} id="sideMenu" aria-labelledby="sideMenuLabel">
                    <div className="offcanvas-header separator-border-dark-bottom">
                        <img src={logo} alt="Logo" className="me-2" width="40px" height="40px" />
                        <h5 className="offcanvas-title" id="sideMenuLabel">LCLPLauncher</h5>
                        <span className="badge bg-secondary px-1 ms-1 mt-1">v{process.env.npm_package_version}</span>
                        <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                    </div>
                    <div className="offcanvas-body p-0">
                        <div className="list-group list-group-flush sidemenu-item">
                            <a href="https://lclpnet.work" className="list-group-item list-group-item-action p-3 bg-dark navigation-link-color">Website</a>
                        </div>
                        <div className="w-100 py-2" style={{ left: '0px', bottom: '0px', position: 'absolute' }}>
                            <button className="btn-nostyle navigation-link-color float-start" type="button">
                                <span className="material-icons" style={{ verticalAlign: 'bottom' }}>settings</span> Settings
                            </button>
                            <button className="btn-nostyle danger-link-color float-end" type="button">
                                <span className="material-icons" style={{ verticalAlign: 'bottom' }}>exit_to_app</span> Exit
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    componentDidMount() {
        const sideMenu = document.getElementById('sideMenu');
        sideMenu?.addEventListener('show.bs.offcanvas', () => {
            const elements = document.querySelectorAll('.dragarea');
            elements.forEach(node => {
                if (node instanceof HTMLElement) {
                    const list = (node as HTMLElement).classList;
                    list.add('dragarea-temp');
                    list.remove('dragarea');
                }
            });
        });
        sideMenu?.addEventListener('hide.bs.offcanvas', () => {
            const elements = document.querySelectorAll('.dragarea-temp');
            elements.forEach(node => {
                if (node instanceof HTMLElement) {
                    const list = (node as HTMLElement).classList;
                    list.add('dragarea');
                    list.remove('dragarea-temp');
                }
            });
        });
    }
}

export default Menubar;