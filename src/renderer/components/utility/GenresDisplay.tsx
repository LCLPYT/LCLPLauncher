import React, { Component } from 'react';
import Genre from '../../../common/types/Genre';

class GenresDisplay extends Component<{ values: Genre[], theme?: string }> {
    render() {
        return (
            <div className="d-flex flex-wrap text-lighter" id="genres-display">
                <span className="fw-bold me-1">Genres:</span>
                {
                    this.props.values.map(genre => <span key={genre.id} className={`badge rounded-pill bg-${this.props.theme ? this.props.theme : 'secondary'} me-1 mb-1 text-lighter`}>{genre.name}</span>)
                }
            </div>
        );
    }
}

export default GenresDisplay;