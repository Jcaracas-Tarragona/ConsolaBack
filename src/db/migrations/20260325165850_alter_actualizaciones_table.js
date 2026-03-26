/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

  export async function up(knex) {

  const hasIp = await knex.schema.hasColumn("actualizaciones", "ip");
  const hasVersion = await knex.schema.hasColumn("actualizaciones", "version");

  if (!hasIp || !hasVersion) {
    await knex.schema.alterTable("actualizaciones", (table) => {

      if (!hasIp) table.string("ip", 50);
      if (!hasVersion) table.string("version", 50);

    });
  }

  /* ÍNDICES (try/catch por si ya existen) */
  try {
    await knex.schema.alterTable("actualizaciones", (table) => {
      table.index(["estado", "fecha"], "idx_estado_fecha");
    });
  } catch {}

  try {
    await knex.schema.alterTable("actualizaciones", (table) => {
      table.index(["equipo", "modulo", "fecha"], "idx_equipo_modulo_fecha");
    });
  } catch {}

  try {
    await knex.schema.alterTable("actualizaciones", (table) => {
      table.unique(["equipo", "modulo", "fecha"], "uniq_equipo_modulo_fecha");
    });
  } catch {}

}


/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable("actualizaciones", (table) => {

    table.dropUnique([], "uniq_equipo_modulo_fecha");

    table.dropIndex([], "idx_estado_fecha");
    table.dropIndex([], "idx_equipo_modulo_fecha");

    table.dropColumn("ip");
    table.dropColumn("version");

  });
}