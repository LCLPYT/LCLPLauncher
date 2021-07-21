import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { app } from 'electron';
import * as path from 'path';
import { isDevelopment } from '../../common/env';

export let database: Database<sqlite3.Database, sqlite3.Statement> | null = null;

export function initDatabase() {
    const file = path.resolve(app.getPath('userData'), 'db.sqlite3');
    open({
        filename: file,
        driver: sqlite3.Database
    }).then(db => {
        database = db;

        console.log('Database loaded successfully.', 'Migrating...');

        const segmentsSuffix = ['static', 'migrations'];
        db.migrate({
            migrationsPath: isDevelopment ? path.resolve(process.cwd(), ...segmentsSuffix) : path.resolve(process.cwd(), 'resources', ...segmentsSuffix)
        }).then(() => {
            console.log('Database migration successful.');
        }).catch(reason => {
            console.log('Database migration failed:', reason)
        });
    }).catch(reason => {
        console.log('Failed to setup database.', reason);
    });
}