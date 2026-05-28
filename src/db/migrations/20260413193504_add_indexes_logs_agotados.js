/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 🔥 Índice compuesto (clave para filtros por agotados + fecha)
  await knex.schema.raw(`
    CREATE INDEX idx_logs_agotados_created_at 
    ON logs ("valorNuevo", "created_at");
  `);

  // 🔥 Índice por local (join + agrupación)
  await knex.schema.raw(`
    CREATE INDEX idx_logs_codlocal 
    ON logs ("codLocal");
  `);

  // 🔥 Índice por producto (agrupación)
  await knex.schema.raw(`
    CREATE INDEX idx_logs_articulo 
    ON logs ("nombre_articulo");
  `);
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_logs_agotados_fecha;
  `);

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_logs_codlocal;
  `);

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_logs_articulo;
  `);
}