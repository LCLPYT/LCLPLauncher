import React, { Component } from 'react';

class LoadingSpinner extends Component {
    render() {
        return (
            <div className="spinner-border mx-auto text-lighter" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        );
    }
}

export default LoadingSpinner;