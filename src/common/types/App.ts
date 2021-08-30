import Genre from "./Genre";

type App = {
    id: number,
    key: string,
    title: string,
    tags?: string,
    description?: string,
    cost?: number,
    genres: Genre[],
    type?: 'software' | 'game'
}

export default App;