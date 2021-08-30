import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('installed_apps', table => {
        table.bigInteger('app_id').notNullable();
        table.foreign('app_id').references('library_apps.id').onDelete('cascade');
        table.string('path', 1024);
    }).then(() => console.log('Created installed_apps table'));
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('installed_apps');
}

