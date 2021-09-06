type AppFeedItem = {
    id: number;
    app_id: number;
    title?: string;
    comment?: string;
    type: 'none' | 'image' | 'youtube';
    content?: string;
    created_at: string
};

export default AppFeedItem;