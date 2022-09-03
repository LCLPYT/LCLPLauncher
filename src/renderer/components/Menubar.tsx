import React, { Component } from 'react';
import { NavLink } from 'react-router-dom';
import { Offcanvas } from 'bootstrap';
import logo from '../img/logo.svg';
import { UTILITIES } from '../utils/ipc';
import { isDevelopment } from '../../common/utils/env';
import { getAppVersion } from '../utils/env';
import { translate as t } from '../../common/utils/i18n';

interface State {
    version?: string
}

class Menubar extends Component<{}, State> {
    constructor(props: {}) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <>
                <header id="header" className="sticky-top">
                    <nav className="navbar navbar-expand navbar-dark bg-dark p-0 dragarea ui-separator-top align-items-stretch">
                        <button className="btn-nostyle navigation-link-color nodragarea btn-drawer-menu ui-separator-bottom ui-separator-right px-3" type="button" data-bs-toggle="offcanvas" data-bs-target="#sideMenu" aria-controls="sideMenu">
                            <span className="material-icons cursor-pointer" style={{ verticalAlign: 'bottom' }}>menu</span>
                        </button>
                        <ul className="navbar-nav me-auto mb-0 nodragarea">
                            <NavItem route="/home" title="Home" icon="home" />
                            <NavItem route="/library" title="Library" icon="bookmarks" iconSize="21px" />
                        </ul>
                        <div className="flex-fill ui-separator-bottom" />
                    </nav>
                </header>
                <div className="offcanvas offcanvas-start" tabIndex={-1} id="sideMenu" aria-labelledby="sideMenuLabel">
                    <div className="offcanvas-header separator-border-dark-bottom">
                        <div className="d-flex align-items-center">
                            <img src={logo} alt="Logo" className="me-2" width="40px" height="40px" />
                            <h5 className="offcanvas-title" id="sideMenuLabel">{t('app.name')}</h5>
                            <span className="badge bg-secondary px-1 ms-1 mt-1">v{this.state.version ? this.state.version : '?'}</span>
                            {isDevelopment ? (<span className="badge bg-warning px-1 ms-1 mt-1">dev</span>) : ''}
                        </div>
                        <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                    </div>
                    <div className="offcanvas-body p-0">
                        <div className="list-group list-group-flush sidemenu-item cursor-pointer">
                            <a href="https://lclpnet.work" className="list-group-item list-group-item-action p-3 bg-dark navigation-link-color">
                                {t('website')} <span className="material-icons" style={{ verticalAlign: 'bottom' }}>link</span>
                            </a>
                        </div>
                        <div className="w-100 py-2" style={{ left: '0px', bottom: '0px', position: 'absolute' }}>
                            <NavLink to="/settings" className="btn-nostyle navigation-link-color cursor-pointer float-start no-underline close-menu-on-click" activeClassName="active">
                                <span className="material-icons" style={{ verticalAlign: 'bottom' }}>settings</span> {t('settings')}
                            </NavLink>
                            <button id="menuCloseBtn" className="btn-nostyle danger-link-color float-end" type="button">
                                <span className="material-icons cursor-pointer" style={{ verticalAlign: 'bottom' }}>exit_to_app</span> {t('exit')}
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    componentDidMount() {
        getAppVersion().then(version => this.setState({ version: version }));

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

        const bsOffcanvas = new Offcanvas(sideMenu as Element);
        document.querySelectorAll('.close-menu-on-click').forEach(element => {
            element.addEventListener('click', () => bsOffcanvas.hide());
        });

        const menuCloseBtn = document.getElementById('menuCloseBtn');
        menuCloseBtn?.addEventListener('click', () => UTILITIES.exitApp());
    }
}

class NavItem extends Component<{ route: string, title: string, icon?: string, iconSize?: string }> {
    render() {
        return (
            <li className="nav-item ui-separator-right">
                <NavLink to={this.props.route} className="nav-link cursor-pointer d-inline-flex align-items-center ui-separator-bottom" activeClassName="active">
                    {this.props.icon ? (
                        <span className="material-icons me-1" style={this.props.iconSize ? {fontSize: this.props.iconSize} : undefined}>
                            {this.props.icon}
                        </span>
                    ) : undefined}
                    {this.props.title}
                </NavLink>
            </li>
        );
    }
}

export default Menubar;