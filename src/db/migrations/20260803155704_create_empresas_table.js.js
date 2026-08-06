export async function up(knex) {
  await knex.schema.createTable("empresas", (table) => {

    table.increments("id").primary();

    table.string("codigo", 30).notNullable().unique();

    table.string("nombre", 120).notNullable();

    table.string("descripcion", 255);

    table.boolean("activo").notNullable().defaultTo(true);

    table.timestamps(true, true);

  });

  await knex("empresas").insert([
    {
      codigo: "QA",
      nombre: "QA",
      descripcion: "Respaldo Tarragona"
    },
    {
      codigo: "EMPRESA1",
      nombre: "Tarragona",
      descripcion: "Producción Tarragona"
    },
    {
      codigo: "EMPRESA2",
      nombre: "Elemental - Pollo Stop",
      descripcion: "Producción Elemental"
    }
  ]);
}

export async function down(knex) {

  await knex.schema.dropTableIfExists("empresas");

}