import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import '../../style/pages/home.css';
import FeaturedItems, { fetchFeaturedItems } from './home/FeaturedItems';

class Home extends Component {

    constructor(props: any) {
        super(props);
        fetchFeaturedItems().then(items => {
            const frame = document.getElementById('previewFrame') as HTMLDivElement;
            if (frame) ReactDOM.render(<FeaturedItems items={ items } />, frame);
        });
    }

    render() {
        return (
            <>
                <div className="container-lg mt-3">
                    <div id="previewFrame" />
                </div>
            </>
        );
    }
}

export default Home;