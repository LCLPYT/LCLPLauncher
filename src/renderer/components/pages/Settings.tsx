import React, { Component } from 'react';

class Settings extends Component {
    render() {
        return (
            <div className="container mt-3">
                <h3 className="text-lighter">Settings</h3>
                <div className="row">
                    <div className="col-3">
                        <div className="list-group">
                            <a href="#" className="list-group-item disabled">Settings</a>
                            <a href="#" className="list-group-item list-group-item-action active disabled">Launcher</a>
                        </div>
                        <br />
                    </div>
                    <div className="col-9">
                        Content
                    </div>
                </div>
            </div>
        );
    }
}

export default Settings;