export async function up(knex) {
  await knex.schema.createTable("estados", (table) => {
    table.increments("id").primary();

    table.string("codigo", 50).notNullable();
    table.string("nombre", 100).notNullable();

    // Familia a la que pertenece el estado:
    // GESTION, GESTION_LOCAL, etc.
    table.string("grupo", 50).notNullable();

    // Permite controlar el orden en selects/listados
    table.integer("orden").notNullable().defaultTo(0);

    // Permite dejar de utilizar un estado sin eliminarlo
    table.boolean("activo").notNullable().defaultTo(true);

    table.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.unique(["grupo", "codigo"]);
  });

  await knex.schema.raw(`
    CREATE INDEX idx_estados_grupo_activo
    ON estados (grupo, activo);
  `);

  // Estados iniciales de una gestión
  await knex("estados").insert([
    {
      codigo: "PENDIENTE",
      nombre: "Pendiente",
      grupo: "GESTION",
      orden: 1
    },
    {
      codigo: "EN_EJECUCION",
      nombre: "En ejecución",
      grupo: "GESTION",
      orden: 2
    },
    {
      codigo: "SUSPENDIDA",
      nombre: "Suspendida",
      grupo: "GESTION",
      orden: 3
    },
    {
      codigo: "FINALIZADA",
      nombre: "Finalizada",
      grupo: "GESTION",
      orden: 4
    },
    {
      codigo: "CANCELADA",
      nombre: "Cancelada",
      grupo: "GESTION",
      orden: 5
    }
  ]);

  // Estados de cada local dentro de una gestión
  await knex("estados").insert([
    {
      codigo: "PENDIENTE",
      nombre: "Pendiente",
      grupo: "GESTION_LOCAL",
      orden: 1
    },
    {
      codigo: "TERMINADO",
      nombre: "Terminado",
      grupo: "GESTION_LOCAL",
      orden: 2
    },
    {
      codigo: "NO_APLICADO",
      nombre: "No aplicado",
      grupo: "GESTION_LOCAL",
      orden: 3
    },
    {
      codigo: "NO_APLICA",
      nombre: "No aplica",
      grupo: "GESTION_LOCAL",
      orden: 4
    }
  ]);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("estados");
}