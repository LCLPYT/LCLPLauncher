import React, { Component } from 'react';

class LoadingSpinner extends Component<{ className?: string, growing?: boolean}> {
    render() {
        return (
            <div className={`spinner-${this.props.growing ? 'grow' : 'border'} mx-auto text-lighter${this.props.className ? ` ${this.props.className}` : ''}`} role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        );
    }
}

export default LoadingSpinner;