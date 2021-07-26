import { Model } from "objection";
import App from "../../../common/types/App";

export interface LibaryApplication extends App {}
export class LibaryApplication extends Model {
    static get tableName() {
        return 'library_applications';
    }
}