import React, { Component } from 'react';

class LoadingSpinner extends Component<{className?: string}> {
    render() {
        return (
            <div className={`spinner-border mx-auto text-lighter${this.props.className ? ` ${this.props.className}` : ''}`} role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        );
    }
}

export default LoadingSpinner;