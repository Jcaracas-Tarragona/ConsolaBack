export async function up(knex) {
  await knex.schema.alterTable("vendedor_import_preview", table => {
    table.dropColumn("usuario_id");
  });

  await knex.schema.alterTable("vendedor_import_preview", table => {
    table.integer("usuario_id").nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable("vendedor_import_preview", table => {
    table.dropColumn("usuario_id");
  });

  await knex.schema.alterTable("vendedor_import_preview", table => {
    table.uuid("usuario_id").nullable();
  });
}