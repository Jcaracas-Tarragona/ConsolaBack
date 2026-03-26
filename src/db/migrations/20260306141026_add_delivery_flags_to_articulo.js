/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.alterTable("articulos", (table) => {
    table.boolean("pya").defaultTo(false);
    table.boolean("rappi").defaultTo(false);
    table.boolean("uber").defaultTo(false);
  });
}

export async function down(knex) {
  await knex.schema.alterTable("articulos", (table) => {
    table.dropColumn("pya");
    table.dropColumn("rappi");
    table.dropColumn("uber");
  });
}