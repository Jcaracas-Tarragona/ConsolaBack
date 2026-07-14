export async function up(knex) {
  await knex.schema.createTable("scheduled_tasks", (table) => {
    table.increments("id").primary();

    table.string("codigo", 50).notNullable().unique();
    table.string("nombre", 150).notNullable();
    table.text("descripcion");

    table.boolean("activo").notNullable().defaultTo(true);

    table.boolean("requiere_confirmacion")
      .notNullable()
      .defaultTo(false);

    // Lunes = 1 ... Domingo = 7
    table.integer("dia_activar").notNullable();

    table.integer("dia_desactivar").notNullable();

    // Permite saltar una desactivación puntual
    table.boolean("omitir_proxima_desactivacion")
      .notNullable()
      .defaultTo(false);

    table.timestamp("ultima_ejecucion");

    table.string("ultimo_resultado", 50);

    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("scheduled_tasks");
}