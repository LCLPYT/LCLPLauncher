import React, { Component } from 'react';
import '../../../style/pages/search.scss';

class Search extends Component {
    render() {
        return (
            <div className="p-3">
                <h2 className="text-lighter">Search Applications</h2>
                <div id="autocomplete" className="d-flex align-items-center mt-3">
                    <div className="ac-wrapper-prefix">
                        <button className="ac-submit h-100" id="searchBtn">
                            <svg className="ac-search-icon selectable" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M16.041 15.856c-0.034 0.026-0.067 0.055-0.099 0.087s-0.060 0.064-0.087 0.099c-1.258 1.213-2.969 1.958-4.855 1.958-1.933 0-3.682-0.782-4.95-2.050s-2.050-3.017-2.050-4.95 0.782-3.682 2.050-4.95 3.017-2.050 4.95-2.050 3.682 0.782 4.95 2.050 2.050 3.017 2.050 4.95c0 1.886-0.745 3.597-1.959 4.856zM21.707 20.293l-3.675-3.675c1.231-1.54 1.968-3.493 1.968-5.618 0-2.485-1.008-4.736-2.636-6.364s-3.879-2.636-6.364-2.636-4.736 1.008-6.364 2.636-2.636 3.879-2.636 6.364 1.008 4.736 2.636 6.364 3.879 2.636 6.364 2.636c2.125 0 4.078-0.737 5.618-1.968l3.675 3.675c0.391 0.391 1.024 0.391 1.414 0s0.391-1.024 0-1.414z" />
                            </svg>
                        </button>
                    </div>
                    <div className="ac-wrapper">
                        <input type="text" id="searchInput" className="ac-input" placeholder="Search for apps" />
                    </div>
                    <div className="ac-wrapper-suffix">
                        <button className="ac-clear h-100" id="clearBtn" hidden>
                            <svg className="ac-clear-icon selectable" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M5.293 6.707l5.293 5.293-5.293 5.293c-0.391 0.391-0.391 1.024 0 1.414s1.024 0.391 1.414 0l5.293-5.293 5.293 5.293c0.391 0.391 1.024 0.391 1.414 0s0.391-1.024 0-1.414l-5.293-5.293 5.293-5.293c0.391-0.391 0.391-1.024 0-1.414s-1.024-0.391-1.414 0l-5.293 5.293-5.293-5.293c-0.391-0.391-1.024-0.391-1.414 0s-0.391 1.024 0 1.414z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    componentDidMount() {
        const input = document.getElementById('searchInput') as HTMLInputElement;
        const clearBtn = document.getElementById('clearBtn');

        input.addEventListener('input', () => {
            console.log('change');
            if(clearBtn) clearBtn.hidden = input.value.trim().length <= 0;
        });
        clearBtn?.addEventListener('click', () => input.value = '');
    }
}

export default Search;