import React, { Component } from 'react';

class Titlebar extends Component {
    render() {
        return (
            <div id='drag-region'>
                <div id="window-title">
                    <span>LCLPLauncher</span>
                </div>
                <div id='window-controls'>
                    <div className="button" id="min-button">
                        <svg width="11" height="1" viewBox="0 0 11 1">
                            <path d="m11 0v1h-11v-1z" stroke-width=".26208" />
                        </svg>
                    </div>
                    <div className="button" id="max-button">
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <path d="m10-1.6667e-6v10h-10v-10zm-1.001 1.001h-7.998v7.998h7.998z" stroke-width=".25" />
                        </svg>
                    </div>
                    <div className="button" id="restore-button">
                        <svg width="11" height="11" viewBox="0 0 11 11">
                            <path
                                d="m11 8.7978h-2.2021v2.2022h-8.7979v-8.7978h2.2021v-2.2022h8.7979zm-3.2979-5.5h-6.6012v6.6011h6.6012zm2.1968-2.1968h-6.6012v1.1011h5.5v5.5h1.1011z"
                                stroke-width=".275" />
                        </svg>
                    </div>
                    <div className="button" id="close-button">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path
                                d="m6.8496 6 5.1504 5.1504-0.84961 0.84961-5.1504-5.1504-5.1504 5.1504-0.84961-0.84961 5.1504-5.1504-5.1504-5.1504 0.84961-0.84961 5.1504 5.1504 5.1504-5.1504 0.84961 0.84961z"
                                stroke-width=".3" />
                        </svg>
                    </div>
                </div>
            </div>
        );
    }
}

export default Titlebar;