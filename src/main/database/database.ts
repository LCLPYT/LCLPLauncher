import { app } from 'electron';
import * as path from 'path';
import { Knex, knex } from 'knex';
import { Model } from 'objection';

// export let database: Database<sqlite3.Database, sqlite3.Statement> | null = null;
export let knexInstance: Knex<any, unknown[]> | null = null;

export function initDatabase() {
    const file = path.resolve(app.getPath('userData'), 'db.sqlite3');

    knexInstance = knex({
        client: 'sqlite3',
        connection: {
            filename: file
        },
        useNullAsDefault: true
    });

    Model.knex(knexInstance);
}