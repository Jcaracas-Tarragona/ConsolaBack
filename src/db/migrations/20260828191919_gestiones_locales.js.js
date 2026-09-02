export async function up(knex) {
  await knex.schema.createTable("gestiones_locales", (table) => {
    table.bigIncrements("id").primary();

    table.bigInteger("gestion_id")
      .notNullable()
      .references("id")
      .inTable("gestiones")
      .onUpdate("CASCADE")
      .onDelete("CASCADE");

    table.integer("connection_id")
      .notNullable()
      .references("id")
      .inTable("connections")
      .onUpdate("CASCADE")
      .onDelete("RESTRICT");

    table.integer("estado_id")
      .notNullable()
      .references("id")
      .inTable("estados")
      .onUpdate("CASCADE")
      .onDelete("RESTRICT");

    table.text("comentario");

    table.timestamp("fecha_aplicacion", {
      useTz: true
    });

    table.integer("actualizado_por")
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

    table.unique([
      "gestion_id",
      "connection_id"
    ]);

    table.index("gestion_id");
    table.index("connection_id");
    table.index("estado_id");
    table.index("actualizado_por");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists(
    "gestiones_locales"
  );
}