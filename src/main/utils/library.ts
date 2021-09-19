import App from "../../common/types/App";
import { LibaryApplication } from "../database/models/LibraryApplication";

export async function addToLibary(app: App): Promise<void> {
    const apps = await LibaryApplication.query().findById(app.id);
    if(!apps) await LibaryApplication.query().insert(app);
}

export async function isInLibrary(app: App | string): Promise<boolean> {
    const promise = isApp(app) ? LibaryApplication.query().findById(app.id) : LibaryApplication.query().where('key', app).first();
    return await promise.then(result => !!result);
}

export async function getLibraryApps(): Promise<App[]> {
    return await LibaryApplication.query();
}

function isApp(app: App | any): app is App {
    return (<App> app).key !== undefined;
}