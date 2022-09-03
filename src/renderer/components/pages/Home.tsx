import ElectronLog from 'electron-log';
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
        }).catch(err => ElectronLog.error('Could not fetch featured items:', err));
    }

    render() {
        return (
            <>
                <div className="container-lg my-3">
                    <div id="previewFrame" />
                </div>
                <div className="container-lg mt-5">
                    <h5 className="text-light">{t('quicknav.title')}</h5>
                    <div>
                    <div className="row row-cols-auto ms-0">
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
            <div className="col pb-2 ps-0 action-card-wrapper">
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