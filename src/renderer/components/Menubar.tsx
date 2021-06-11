import React, { Component } from 'react';
import { Link } from 'react-router-dom';

class Menubar extends Component {
    render() {
        return (
            <header id="header" className="sticky-top">
                <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm px-2 py-1 dragarea">
                    <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent"
                        aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
            
                    <div className="collapse navbar-collapse" id="navbarSupportedContent">
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0 nodragarea">
                            <li className="nav-item mx-1">
                                <Link to="/" className="nav-link">Home</Link>
                            </li>
                            <li className="nav-item mx-1">
                                <Link to="/one" className="nav-link">
                                    Library
                                </Link>
                            </li>
                        </ul>

                        <ul className="navbar-nav ms-auto mb-2 mb-lg-0 nodragarea">
                            <li className="nav-item" style={{ display: 'inline-flex' }}>
                                <Link to="/one" className="nav-link p-0">
                                    <span className="material-icons" style={{ verticalAlign: 'middle' }}>settings</span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </nav>
            </header>
        );
    }
}

export default Menubar;