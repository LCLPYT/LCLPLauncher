# Migrations
To create a new migration, use the `migrate:make` command in the migrations directory:
```bash
npx knex migrate:make migration_name_here -x ts --migrations-directory .
```