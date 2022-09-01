import type App from "../../common/types/App";
import { InstalledApplication } from "../database/models/InstalledApplication";
import { exists } from "../core/io/fshelper";

export async function getInstallationDirectory(app: App) {
    const installedApp = await InstalledApplication.query().where('app_id', app.id).first();
    if (!installedApp || !await exists(installedApp.path)) return undefined;

    return installedApp.path;
}