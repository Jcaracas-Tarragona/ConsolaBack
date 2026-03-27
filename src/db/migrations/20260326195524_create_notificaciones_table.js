export async function up(knex) {
  return knex.schema.createTable("notificaciones", (table) => {
    table.increments("id").primary();

    table.string("titulo", 255).notNullable();
    table.text("contenido").notNullable();

    table.boolean("leido").defaultTo(false);

    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  return knex.schema.dropTable("notificaciones");
}