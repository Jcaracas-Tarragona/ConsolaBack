export async function up(knex) {
  await knex.schema.alterTable("notificaciones", (table) => {
    table.string("url", 255).nullable();
  });
}

export async function down(knex) {
  await knex.schema.alterTable("notificaciones", (table) => {
    table.dropColumn("url");
  });
}