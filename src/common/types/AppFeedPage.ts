import AppFeedItem from "./AppFeedItem";

type AppFeedPage = {
    current_page: number;
    data: AppFeedItem[];
    per_page: number;
}

export default AppFeedPage;