import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.schema.debug(true).createTable('library_apps', table => {
        table.bigInteger('id').primary().notNullable();
        table.string('key', 64).unique().notNullable();
        table.string('title', 128).notNullable();
        table.string('tags', 191);
        table.string('description', 512);
        table.decimal('cost', 5, 2).defaultTo(0.00);
    }).then(() => console.log('Created libary_applications table'));
}


export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('library_apps');
}

