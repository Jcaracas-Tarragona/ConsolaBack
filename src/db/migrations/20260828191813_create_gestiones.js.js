export async function up(knex) {
  await knex.schema.createTable("gestiones", (table) => {
    table.bigIncrements("id").primary();

    table.string("nombre", 200).notNullable();
    table.text("descripcion");
    table.string("version", 100);

    table.date("fecha_inicio")
      .notNullable()
      .defaultTo(knex.fn.now());

    table.date("fecha_fin");

    table.integer("estado_id")
      .notNullable()
      .references("id")
      .inTable("estados")
      .onUpdate("CASCADE")
      .onDelete("RESTRICT");

    table.text("motivo_suspension");

    table.timestamp("suspendida_at", {
      useTz: true
    });

    table.integer("creado_por")
      .references("id")
      .inTable("users")
      .onUpdate("CASCADE")
      .onDelete("SET NULL");

    table.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index("estado_id");
    table.index("fecha_inicio");
    table.index("creado_por");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("gestiones");
}