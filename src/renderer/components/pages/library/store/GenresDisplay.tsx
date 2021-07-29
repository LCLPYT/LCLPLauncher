import React, { Component } from 'react';
import Genre from '../../../../../common/types/Genre';

class GenresDisplay extends Component<{ values: Genre[] }> {
    render() {
        return (
            <div className="d-flex pt-2 flex-wrap text-lighter border-top border-secondary mb-3" id="genres-display">
                <span className="fw-bold me-1">Genres:</span>
                {
                    this.props.values.map(genre => <span key={genre.id} className="badge rounded-pill bg-secondary me-1 mb-1 text-lighter">{genre.name}</span>)
                }
            </div>
        );
    }
}

export default GenresDisplay;