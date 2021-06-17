import React, { Component } from 'react';
import '../../style/pages/library.css';

class Library extends Component {
    render() {
        return (
            <>
                <div id="libraryContainer">
                    <div id="librarySidebar" className="separator-border-dark-right">
                        <div className="tab-btn navigation-link-color mb-1 navigation-link-color-active">
                            <span className="material-icons tab-icon">apps</span>
                            <div className="tab-desc">Apps</div>
                        </div>
                        <div className="tab-btn navigation-link-color">
                            <span className="material-icons tab-icon">search</span>
                            <div className="tab-desc">Search</div>
                        </div>
                    </div>
                    <div id="libraryContent" className="pt-3 ps-3">
                        <h2>Library</h2>
                    </div>
                </div>
            </>
        );
    }
}

export default Library;