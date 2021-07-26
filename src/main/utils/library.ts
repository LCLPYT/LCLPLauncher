import App from "../../common/types/App";
import { LibaryApplication } from "../database/models/LibraryApplication";

export async function addToLibary(app: App): Promise<void> {
    const apps = await LibaryApplication.query().findById(app.id);
    if(!apps) await LibaryApplication.query().insert(app);
}