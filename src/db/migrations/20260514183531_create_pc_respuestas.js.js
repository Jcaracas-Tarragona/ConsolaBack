// migrations/20260514_create_pc_respuestas.js

export async function up(knex){

  await knex.schema.createTable("pc_respuestas", (table) => {

    table.bigIncrements("id").primary();

    // 🔥 Relación con connections.codLocal
    table.integer("codlocal").notNullable();

    // 🔥 Respuesta enviada desde PC
    table.text("respuesta").notNullable();

    // 🔥 Leído / no leído
    table.boolean("leido").notNullable().defaultTo(false);

    // 🔥 Fecha creación
    table.timestamp("created_at").defaultTo(knex.fn.now());

    // 🔥 FK
    table
      .foreign("codlocal")
      .references("codLocal")
      .inTable("connections")
      .onDelete("CASCADE");
  });

  // 🔥 Índices importantes
  await knex.schema.raw(`
    CREATE INDEX idx_pc_respuestas_codlocal
    ON pc_respuestas (codlocal);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_pc_respuestas_leido
    ON pc_respuestas (leido);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_pc_respuestas_created
    ON pc_respuestas (created_at DESC);
  `);
};

export async function down(knex)  {

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_pc_respuestas_codlocal;
  `);

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_pc_respuestas_leido;
  `);

  await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_pc_respuestas_created;
  `);

  await knex.schema.dropTableIfExists("pc_respuestas");
};