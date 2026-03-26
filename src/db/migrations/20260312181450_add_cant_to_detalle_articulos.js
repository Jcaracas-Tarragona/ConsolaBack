export async function up(knex) {
  await knex.schema.alterTable("detalle_articulos", (table) => {
    table.integer("cant").notNullable().defaultTo(1);
  });
}

export async function down(knex) {
  await knex.schema.alterTable("detalle_articulos", (table) => {
    table.dropColumn("cant");
  });
}