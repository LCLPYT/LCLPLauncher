import React, { Component } from 'react';
import { translate as t } from '../../../common/utils/i18n';

class LoadingSpinner extends Component<{ className?: string, growing?: boolean, noMargin?: boolean}> {
    render() {
        return (
            <div className={`spinner-${this.props.growing ? 'grow' : 'border'}${this.props.noMargin ? '' : ' mx-auto'} text-lighter${this.props.className ? ` ${this.props.className}` : ''}`} role="status">
                <span className="visually-hidden">{t('loading')}...</span>
            </div>
        );
    }
}

export default LoadingSpinner;