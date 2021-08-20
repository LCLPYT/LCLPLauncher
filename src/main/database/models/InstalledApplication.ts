import { Model } from "objection";

export type InstalledApp = {
    app_id: number,
    path: string
}

export interface InstalledApplication extends InstalledApp {}
export class InstalledApplication extends Model {
    static get tableName() {
        return 'installed_apps';
    }
}