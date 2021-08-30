import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('library_apps', table => {
        table.string('type', 32).notNullable();
    }).then(() => console.log('Added type column to library_apps table'));
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('library_apps', table => {
        table.dropColumn('type');
    });
}