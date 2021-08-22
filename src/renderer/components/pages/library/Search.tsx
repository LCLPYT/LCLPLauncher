import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import tippy from 'tippy.js';
import { getBackendHost } from '../../../../common/utils/settings';
import '../../../style/pages/search.scss';

interface IProps {

}

interface IState {
    autoCompleteItems: AppAutoComplete[];
}

class Search extends Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            autoCompleteItems: []
        };
    }

    private query: string = '';

    render() {
        return (
            <div className="container-lg p-3">
                <h2 className="text-lighter">Search Apps</h2>
                <div id="autocomplete" className="d-flex align-items-center mt-3">
                    <div className="ac-wrapper-prefix">
                        <button className="ac-submit h-100 d-flex align-items-center" id="searchBtn">
                            <svg className="ac-search-icon cursor-pointer" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                <path d="M16.041 15.856c-0.034 0.026-0.067 0.055-0.099 0.087s-0.060 0.064-0.087 0.099c-1.258 1.213-2.969 1.958-4.855 1.958-1.933 0-3.682-0.782-4.95-2.050s-2.050-3.017-2.050-4.95 0.782-3.682 2.050-4.95 3.017-2.050 4.95-2.050 3.682 0.782 4.95 2.050 2.050 3.017 2.050 4.95c0 1.886-0.745 3.597-1.959 4.856zM21.707 20.293l-3.675-3.675c1.231-1.54 1.968-3.493 1.968-5.618 0-2.485-1.008-4.736-2.636-6.364s-3.879-2.636-6.364-2.636-4.736 1.008-6.364 2.636-2.636 3.879-2.636 6.364 1.008 4.736 2.636 6.364 3.879 2.636 6.364 2.636c2.125 0 4.078-0.737 5.618-1.968l3.675 3.675c0.391 0.391 1.024 0.391 1.414 0s0.391-1.024 0-1.414z" />
                            </svg>
                        </button>
                    </div>
                    <div className="ac-wrapper">
                        <input type="text" id="searchInput" className="ac-input" placeholder="Search for apps" autoFocus />
                    </div>
                    <div className="ac-wrapper-suffix">
                        <button className="ac-clear h-100" id="clearBtn" hidden>
                            <svg className="ac-clear-icon selectable cursor-pointer" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                <path d="M5.293 6.707l5.293 5.293-5.293 5.293c-0.391 0.391-0.391 1.024 0 1.414s1.024 0.391 1.414 0l5.293-5.293 5.293 5.293c0.391 0.391 1.024 0.391 1.414 0s0.391-1.024 0-1.414l-5.293-5.293 5.293-5.293c0.391-0.391 0.391-1.024 0-1.414s-1.024-0.391-1.414 0l-5.293 5.293-5.293-5.293c-0.391-0.391-1.024-0.391-1.414 0s-0.391 1.024 0 1.414z" />
                            </svg>
                        </button>
                    </div>
                </div>
                <ul id="acItems" className="list-group">
                    {
                        this.state.autoCompleteItems.map((item, idx) => <AutoCompleteItem item={item} query={this.query} index={idx} key={item.key} />)
                    }
                </ul>
            </div>
        );
    }
    componentDidMount() {
        const container = document.getElementById('autocomplete');
        const input = document.getElementById('searchInput') as HTMLInputElement;
        const clearBtn = document.getElementById('clearBtn');
        const searchBtn = document.getElementById('searchBtn');

        input.addEventListener('input', () => {
            const query = input.value.trim();
            if (clearBtn) clearBtn.hidden = query.length <= 0;
            this.onInputChanged(query);
        });
        container?.addEventListener('focusin', () => {
            const acItems = document.getElementById('acItems');
            acItems?.firstElementChild?.classList.add('is-offset');
        });
        container?.addEventListener('focusout', () => {
            const acItems = document.getElementById('acItems');
            acItems?.firstElementChild?.classList.remove('is-offset');
        });
        clearBtn?.addEventListener('click', () => {
            input.value = '';
            this.onInputChanged('');
        });
        searchBtn?.addEventListener('click', event => {
            event.preventDefault();
        });
    }

    private debounceTimer?: NodeJS.Timeout;

    onInputChanged(query: string) {
        query = query.toLowerCase();
        this.query = query;
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        const minCharacters = 2;
        if (query.length < minCharacters) {
            this.displayAutoComplete([]); // clear items
            return;
        }

        const debounce = 300; // ms
        this.debounceTimer = setTimeout(() => this.doAutoComplete(query), debounce);
    }

    doAutoComplete(query: string) {
        fetch(`${getBackendHost()}/api/lclplauncher/apps/search?q=${query}&format=short`)
            .then(response => response.json())
            .then(result => this.displayAutoComplete(result as AppAutoComplete[]));
    }

    displayAutoComplete(items: AppAutoComplete[]) {
        const autocomplete = document.getElementById('autocomplete');
        if (autocomplete) {
            if (items.length > 0) autocomplete.classList.add('ac-has-items')
            else autocomplete.classList.remove('ac-has-items');
        }

        this.setState({ autoCompleteItems: items });
    }
}

type AppAutoComplete = {
    readonly id: number;
    readonly key: string;
    readonly title: string;
};

class AutoCompleteItem extends Component<{ item: AppAutoComplete, query: string, index: number }> {
    render() {
        const first = this.props.index <= 0;
        const isOffset = first && document.activeElement && document.activeElement.id === 'searchInput';
        return (
            <Link to={`/library/store/app/${this.props.item.key}`} className={`list-group-item list-group-item-action cursor-pointer p-2 d-flex align-items-center${isOffset ? ' is-offset' : ''}`}>
                <img src={`${getBackendHost()}/api/lclplauncher/apps/assets/banner-small/${this.props.item.key}`} alt="App preview" className="rounded" width="120" height="45" />
                <div className="ms-3 flex-grow-1">{ this.constructTitle() }</div>
                <span className="material-icons text-light pe-1 app-link">arrow_forward</span>
            </Link>
        );
    }

    constructTitle(): JSX.Element[] {
        let spanCount = 0;

        function createSpan(content: string, marked: boolean) {
            return <span key={`sp${spanCount++}`} className={marked ? 'text-warning fw-bold' : 'fw-bold'}>{content}</span>;
        }

        const title = this.props.item.title;
        const query = this.props.query;

        const splitIdx = title.toLowerCase().indexOf(query.toLowerCase());

        if(splitIdx < 0) {
            return [ createSpan(title, false), <span className="badge bg-info ms-2" key="_tags-matching">Matching tags</span> ];
        } else {
            const spans: JSX.Element[] = [];
            
            if(splitIdx > 0) spans.push(createSpan(title.substring(0, splitIdx), false));

            const splitEnd = splitIdx + query.length;
            spans.push(createSpan(title.substring(splitIdx, splitEnd), true));

            if(splitEnd < title.length) spans.push(createSpan(title.substring(splitEnd, title.length), false));

            return spans;
        }
    }

    componentDidMount() {
        tippy('.app-link', {
            content: 'Go to store page',
            animation: 'scale'
        });
    }
}

export default Search;