export async function up(knex) {
  await knex.schema.createTable("scheduled_task_results", (table) => {
    table.increments("id").primary();

    table.integer("task_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("scheduled_tasks")
      .onDelete("CASCADE");

    table.integer("connection_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("connections")
      .onDelete("CASCADE");

    table.string("estado", 20)
      .notNullable();

    table.text("mensaje");

    table.timestamp("created_at")
      .defaultTo(knex.fn.now());

    table.index(["task_id"]);
    table.index(["connection_id"]);
    table.index(["estado"]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists(
    "scheduled_task_results"
  );
}