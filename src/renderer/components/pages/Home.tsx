import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import '../../style/pages/home.css';
import FeaturedItems, { fetchFeaturedItems } from './home/FeaturedItems';

class Home extends Component {

    constructor(props: any) {
        super(props);
        fetchFeaturedItems().then(items => {
            const frame = document.getElementById('previewFrame') as HTMLDivElement;
            if (frame) ReactDOM.render(<FeaturedItems items={items} />, frame);
        });
    }

    render() {
        return (
            <>
                <div className="container-lg mt-3">
                    <div id="previewFrame" />
                    <div className="mt-5">
                        <h5 className="text-light">Actions</h5>
                        <div className="row action-list">
                            <HomeAction icon="search" name="Search games" link="/library/search" />
                            <HomeAction icon="apps" name="My apps" link="/library/apps" />
                            <HomeAction icon="settings" name="Settings" link="/settings" />
                        </div>
                    </div>
                </div>
            </>
        );
    }
}

class HomeAction extends Component<{ icon: string, name: string, link: string }> {
    render() {
        return (
            <div className="col">
                <Link to={this.props.link} className="navigation-link-color-dimmed no-underline">
                    <div className="card py-3 text-center shadow">
                        <span className="material-icons action-card-icon">{this.props.icon}</span>
                        <span>{this.props.name}</span>
                    </div>
                </Link>
            </div>
        );
    }
}

export default Home;