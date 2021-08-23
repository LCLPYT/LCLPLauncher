import React, { Component } from "react";

class AppSettingsModal extends Component {
    render() {
        return (
            <div className="modal fade" id="appSettingsModal" tabIndex={-1} aria-labelledby="appSettingsModalLabel" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title text-lighter" id="appSettingsModalLabel">App Settings</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            Hello World
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default AppSettingsModal;