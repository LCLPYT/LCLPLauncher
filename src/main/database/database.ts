import { app } from 'electron';
import * as path from 'path';
import { Knex, knex } from 'knex';
import { Model } from 'objection';

// export let database: Database<sqlite3.Database, sqlite3.Statement> | null = null;
export let knexInstance: Knex<any, unknown[]> | null = null;

export async function initDatabase() {
    if (knexInstance) return; // database already initialized
    
    const file = path.resolve(app.getPath('userData'), 'db.sqlite3');

    knexInstance = knex({
        client: 'sqlite3',
        connection: {
            filename: file
        },
        useNullAsDefault: true
    });

    Model.knex(knexInstance);

    // knexInstance.migrate.rollback({ migrationSource: new WebpackMigrationSource(require.context('./migrations', false, /^\.\/.*\.ts$/)) });
    await knexInstance.migrate.latest({ migrationSource: new WebpackMigrationSource(require.context('./migrations', false, /^\.\/.*\.ts$/)) });
}

class WebpackMigrationSource {
    protected migrationContext: __WebpackModuleApi.RequireContext;

    constructor(migrationContext: __WebpackModuleApi.RequireContext) {
        this.migrationContext = migrationContext;
    }

    getMigrations() {
        return Promise.resolve(this.migrationContext.keys().sort())
    }

    getMigrationName(migration: string) {
        return path.parse(migration).base;
    }

    getMigration(migration: string) {
        return this.migrationContext(migration);
    }
}