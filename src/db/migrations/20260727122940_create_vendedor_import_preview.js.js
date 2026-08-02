export async function up(knex) {
  await knex.schema.createTable("vendedor_import_preview", table => {

    table.increments("id").primary();

    table
      .uuid("usuario_id")
      .nullable();

    table
      .jsonb("summary")
      .notNullable();

    table
      .jsonb("preview")
      .notNullable();

    table
      .timestamp("created_at")
      .defaultTo(knex.fn.now());

  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("vendedor_import_preview");
}