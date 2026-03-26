/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable("actualizaciones", (table) => {
    table.increments("id").primary();

    table.string("equipo", 100).notNullable();
    table.string("modulo", 100).notNullable();
    table.string("estado", 50).notNullable();

    table.timestamp("fecha").notNullable();

    // extras útiles para monitoreo
    table.string("ip", 50);
    table.string("version", 50);

    table.timestamp("created_at").defaultTo(knex.fn.now());

    /* Índices recomendados */
    table.index(["equipo"]);
    table.index(["modulo"]);
    table.index(["fecha"]);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("actualizaciones");
}