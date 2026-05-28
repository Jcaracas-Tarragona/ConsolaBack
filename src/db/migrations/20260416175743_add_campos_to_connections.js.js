// migrations/20260416_add_campos_to_connections.js

export async function up(knex) {
  await knex.schema.alterTable("connections", (table) => {
    table.integer("ck").nullable();
    table.boolean("kds").notNullable().defaultTo(false);
    table.integer("c_kds").nullable();

    table.boolean("llamador").notNullable().defaultTo(false);
    table.integer("c_llamador").nullable();
  });

  // 🔥 Índices recomendados
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_ck ON connections (ck);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_c_kds ON connections (c_kds);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_c_llamador ON connections (c_llamador);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_kds ON connections (kds);
  `);

  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_connections_llamador ON connections (llamador);
  `);
};

export async function down(knex) {
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_connections_ck;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_connections_c_kds;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_connections_c_llamador;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_connections_kds;`);
  await knex.schema.raw(`DROP INDEX IF EXISTS idx_connections_llamador;`);

  await knex.schema.alterTable("connections", (table) => {
    table.dropColumn("ck");
    table.dropColumn("kds");
    table.dropColumn("c_kds");
    table.dropColumn("llamador");
    table.dropColumn("c_llamador");
  });
};