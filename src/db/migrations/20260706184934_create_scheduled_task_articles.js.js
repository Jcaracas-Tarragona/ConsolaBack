export async function up(knex) {
  await knex.schema.createTable("scheduled_task_articles", (table) => {
    table.increments("id").primary();

    table.integer("task_id")
      .unsigned()
      .notNullable()
      .references("id")
      .inTable("scheduled_tasks")
      .onDelete("CASCADE");

    table.string("codigo_articulo", 30)
      .notNullable();

    table.unique([
      "task_id",
      "codigo_articulo"
    ]);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists(
    "scheduled_task_articles"
  );
}