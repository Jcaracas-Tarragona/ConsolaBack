export async function up(knex) {
  await knex.schema.alterTable("logs", (table) => {
    table.text("nombre_articulo");
  });
}

export async function down(knex) {
  await knex.schema.alterTable("logs", (table) => {
    table.dropColumn("nombre_articulo");
  });
}