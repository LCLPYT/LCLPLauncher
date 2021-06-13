import React, { Component } from 'react';
import { Link } from 'react-router-dom';

class Menubar extends Component {
    render() {
        return (
            <header id="header" className="sticky-top">
                <nav className="navbar navbar-expand navbar-dark bg-dark shadow-sm p-1 dragarea" style={{ borderTop: '1px solid #1C2125' }}>
                    <button className="btn-burgermenu nodragarea" type="button">
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
        );
    }
}

export default Menubar;