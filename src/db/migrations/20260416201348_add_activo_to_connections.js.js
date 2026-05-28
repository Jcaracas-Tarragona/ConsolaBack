// migrations/20260416_add_activo_to_connections.js

export async function up(knex) {
  await knex.schema.alterTable("connections", (table) => {
    table
      .boolean("activo")
      .notNullable()
      .defaultTo(true);
  });

  // 🔥 Índice recomendado para filtros frecuentes
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_activo
    ON connections (activo);
  `);
};

export async function down(knex) {
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_connections_activo;
  `);

  await knex.schema.alterTable("connections", (table) => {
    table.dropColumn("activo");
  });
};