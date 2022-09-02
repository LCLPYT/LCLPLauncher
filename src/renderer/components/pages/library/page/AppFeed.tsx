import React, { Component } from "react";
import YouTube from "react-youtube";
import { getBackendHost } from "../../../../../common/utils/settings";
import App from '../../../../../common/types/App';
import AppFeedItem from "../../../../../common/types/AppFeedItem";
import AppFeedPage from "../../../../../common/types/AppFeedPage";
import CollapsableDescription from "../../../utility/CollapsableDescription";
import { translate as t } from "../../../../../common/utils/i18n";

interface Props {
    app: App
}

interface State {
    items: AppFeedItem[]
}

class AppFeed extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            items: []
        };
    }

    render() {
        return (
            <div id="appFeed" className="flex-fill px-4 pb-3 pt-2 text-lighter">
                <div className="fw-bold text-muted mb-1">{t('page.detail.feed')}</div>
                {this.state.items.map((item, index) => {
                    if (index >= this.state.items.length - 1) this.lastItemId = item.id;
                    return <FeedItem key={item.id} item={item} />;
                })}
                {this.state.items.length <= 0 ? (
                    <div className="d-flex text-muted align-items-center justify-content-center pt-5">
                        <div className="feed-text-big">{t('page.detail.feed.empty')}</div>
                    </div>
                ) : undefined}
            </div>
        );
    }

    componentDidMount() {
        this.loadNextPage();
    }

    protected loading = false;
    protected currentPage = 0;
    protected endReached = false;
    protected lastItemId?: number;
    
    loadNextPage() {
        if (this.loading) return;
        this.loading = true;

        fetch(`${getBackendHost()}/api/lclplauncher/app-feed/${this.props.app.key}?page=${++this.currentPage}`)
            .then(resp => resp.json())
            .then(content => {
                this.loading = false;
                const feedPage = content as AppFeedPage;
                this.setState({
                    items: [...this.state.items, ...feedPage.data]
                });
            }).catch(err => {
                this.loading = false;
                console.error(err);
            });
    }

    wasEndReached() {
        return this.endReached;
    }

    getLastElement() {
        return this.lastItemId !== undefined ? document.getElementById(`feed_${this.lastItemId}`) : undefined;
    }
}

interface ItemProps {
    item: AppFeedItem
}

class FeedItem extends Component<ItemProps> {
    render() {
        const date = new Date(this.props.item.created_at);
        const timeString = date.toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' });
        return (
            <div id={`feed_${this.props.item.id}`} className="pb-3">
                <div className="mb-1 d-flex align-items-center justify-content-between">
                    {this.props.item.title ? (
                        <h5 className="mb-0 text-wrap">{this.props.item.title}</h5>
                    ) : undefined}
                    <span className="text-muted timestamp-sm">{timeString}</span>
                </div>
                {this.props.item.comment ? (
                    <div className="text-light mb-1 ws-pre-line feed-mw">
                        <CollapsableDescription id={`comment${this.props.item.id}`} content={this.props.item.comment} />
                    </div>
                ) : undefined}
                {this.getAttachmentBody()}
            </div>
        );
    }

    getAttachmentBody(): JSX.Element | undefined {
        switch (this.props.item.type) {
            case 'image':
                return (
                    <img src={this.props.item.content} alt={this.props.item.title} className="feed-img rounded overflow-hidden shadow-lg" />
                );
            case 'youtube':
                return (
                    <div className="feed-yt-wrapper rounded overflow-hidden shadow-lg">
                        <YouTube videoId={this.props.item.content} className="feed-yt" />
                    </div>
                );
            default:
                return undefined;
        }
    }
}

export default AppFeed;