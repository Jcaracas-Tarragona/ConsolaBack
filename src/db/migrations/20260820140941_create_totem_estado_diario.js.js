/**
 * Crear tabla de estado diario de tótems
 *
 * V1
 * - Un registro por tótem/local/día
 * - Se conserva la primera hora en que el tótem pasa a ON
 * - No se modifica hora_encendido mientras permanezca ON
 */

export async function up(knex) {
  const existe = await knex.schema.hasTable("totem_estado_diario");

  if (existe) {
    return;
  }

  await knex.schema.createTable("totem_estado_diario", (table) => {

    table.increments("id").primary();

    // Empresa a la que pertenece el local
    table
      .integer("empresa_id")
      .notNullable()
      .index();

    // FK hacia connections
    table
      .integer("connection_id")
      .notNullable()
      .index();

    // Código del local
    table
      .integer("codLocal")
      .notNullable()
      .index();

    // Número del tótem dentro del local
    // 1, 2, 3...
    table
      .integer("totem_numero")
      .notNullable();

    // IP calculada para el tótem
    table
      .string("ip", 45)
      .notNullable();

    // Estado actual
    // OFF / ON
    table
      .string("estado", 10)
      .notNullable()
      .defaultTo("OFF");

    // Primera hora en que el tótem respondió ON durante ese día
    table
      .timestamp("hora_encendido")
      .nullable();

    // Última vez que verificamos el estado
    table
      .timestamp("ultima_revision")
      .nullable();

    // Día al que corresponde el registro
    table
      .date("fecha")
      .notNullable();

    table
      .timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    // Evita duplicar un tótem dentro del mismo local/día
    table.unique(
      [
        "empresa_id",
        "connection_id",
        "fecha",
        "totem_numero"
      ],
      "uq_totem_estado_diario"
    );

    // FK
    table
      .foreign("connection_id")
      .references("id")
      .inTable("connections")
      .onDelete("CASCADE");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("totem_estado_diario");
}