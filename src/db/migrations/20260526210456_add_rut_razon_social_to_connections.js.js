// migrations/20260526_add_rut_razon_social_to_connections.js

export async function up(knex){

  await knex.schema.alterTable("connections", (table) => {

    // 🔥 RUT empresa/local
    table.string("rut", 20);

    // 🔥 Razón social
    table.string("razon_social", 255);
  });

  /* =====================================================
     ÍNDICES
  ===================================================== */

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_rut
    ON connections (rut);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_razon_social
    ON connections (razon_social);
  `);
};

export async function down(knex)  {

  /* =====================================================
     ELIMINAR ÍNDICES
  ===================================================== */

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_connections_rut;
  `);

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_connections_razon_social;
  `);

  /* =====================================================
     ELIMINAR COLUMNAS
  ===================================================== */

  await knex.schema.alterTable("connections", (table) => {

    table.dropColumn("rut");

    table.dropColumn("razon_social");
  });
};