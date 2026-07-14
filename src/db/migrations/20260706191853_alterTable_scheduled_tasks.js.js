export async function up(knex) {
  await knex.schema.alterTable("scheduled_task_results", (table) => {
    // Elimina índices antiguos si existen
    table.dropIndex(["task_id"], "scheduled_task_results_task_id_index");
    table.dropIndex(["connection_id"], "scheduled_task_results_connection_id_index");
    table.dropIndex(["estado"], "scheduled_task_results_estado_index");

    // Garantiza un solo resultado por tarea y local
    table.unique(
      ["task_id", "connection_id"],
      "scheduled_task_results_task_connection_unique"
    );

    // Nuevos índices
    table.index(["task_id", "estado"]);
    table.index(["connection_id"]);
  });
}

export async function down(knex) {
  await knex.schema.alterTable("scheduled_task_results", (table) => {
    table.dropUnique(
      ["task_id", "connection_id"],
      "scheduled_task_results_task_connection_unique"
    );

    table.dropIndex(["task_id", "estado"]);
    table.dropIndex(["connection_id"]);

    // Restaurar índices anteriores
    table.index(["task_id"]);
    table.index(["connection_id"]);
    table.index(["estado"]);
  });
}