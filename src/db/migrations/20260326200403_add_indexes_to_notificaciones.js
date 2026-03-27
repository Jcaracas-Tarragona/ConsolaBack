export async function up(knex) {
  return knex.schema.alterTable("notificaciones", (table) => {
    table.index(["leido"], "idx_notificaciones_leido");
    table.index(["created_at"], "idx_notificaciones_created_at");
  });
}

export async function down(knex) {
  return knex.schema.alterTable("notificaciones", (table) => {
    table.dropIndex(["leido"], "idx_notificaciones_leido");
    table.dropIndex(["created_at"], "idx_notificaciones_created_at");
  });
}