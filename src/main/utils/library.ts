import App from "../../common/types/App";
import { LibaryApplication } from "../database/models/LibraryApplication";

export async function addToLibary(app: App): Promise<void> {
    const apps = await LibaryApplication.query().findById(app.id);
    if(!apps) await LibaryApplication.query().insert(app);
}

export async function isInLibrary(app: App): Promise<boolean> {
    return await LibaryApplication.query().findById(app.id)
        .then(result => result ? true : false);
}

export async function getLibraryApps(): Promise<App[]> {
    return await LibaryApplication.query();
}