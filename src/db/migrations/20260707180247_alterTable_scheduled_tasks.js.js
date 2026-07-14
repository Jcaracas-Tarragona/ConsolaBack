export async function up(knex) {
  await knex.schema.alterTable("scheduled_tasks", (table) => {
    table.boolean("visible").notNullable().defaultTo(true);
  });
}

export async function down(knex) {
  await knex.schema.alterTable("scheduled_tasks", (table) => {
    table.dropColumn("visible");
  });
}