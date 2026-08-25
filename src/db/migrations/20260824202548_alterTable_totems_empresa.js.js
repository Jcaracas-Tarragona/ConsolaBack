export async function up(knex) {
  await knex.schema.alterTable("totem_estado_diario", table => {
    table.dropColumn("empresa_id");
  });
}

export async function down(knex) {
  await knex.schema.alterTable("totem_estado_diario", table => {
    table.integer("empresa_id").nullable();
  });
}
