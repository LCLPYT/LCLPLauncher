import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import { translate as t } from '../../../common/utils/i18n';
import '../../style/pages/home.scss';
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
                <div className="container-lg my-3">
                    <div id="previewFrame" />
                    <div className="mt-5">
                        <h5 className="text-light">{t('quicknav.title')}</h5>
                        <div className="row action-list">
                            <HomeAction icon="bookmarks" name={t('quicknav.library')} link="/library/apps" />
                            <HomeAction icon="search" name={t('quicknav.search')} link="/library/search" />
                            <HomeAction icon="settings" name={t('quicknav.settings')} link="/settings" />
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
                <Link to={this.props.link} className="navigation-link-color-dimmed no-underline cursor-pointer">
                    <div className="card py-3 text-center shadow action-card ring">
                        <span className="material-icons action-card-icon">{this.props.icon}</span>
                        <span>{this.props.name}</span>
                    </div>
                </Link>
            </div>
        );
    }
}

export default Home;