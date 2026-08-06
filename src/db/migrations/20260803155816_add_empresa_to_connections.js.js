export async function up(knex) {

  await knex.schema.alterTable("connections", (table) => {

    table
      .integer("empresa_id")
      .unsigned()
      .references("id")
      .inTable("empresas")
      .defaultTo(2);

  });

  // Todos los locales actuales pertenecen a Tarragona
  await knex("connections")
    .update({
      empresa_id: 2
    });

}

export async function down(knex) {

  await knex.schema.alterTable("connections", (table) => {

    table.dropForeign(["empresa_id"]);

    table.dropColumn("empresa_id");

  });

}