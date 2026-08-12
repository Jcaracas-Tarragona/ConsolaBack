export async function up(knex) {

  /*
   * ============================================================
   * ELIMINAR TABLAS OBSOLETAS
   * ============================================================
   *
   * Estas tablas ya no serán utilizadas por la aplicación.
   *
   * Al eliminarlas también eliminamos las FK:
   *
   * zendesks:
   *   zendesks_codigo_local_foreign
   *
   * pc_respuestas:
   *   pc_respuestas_codlocal_foreign
   *
   * Estas FK actualmente dependen del índice CodigoLocal
   * de connections.
   */

  await knex.raw(`
    DROP TABLE IF EXISTS zendesks;
  `);

  await knex.raw(`
    DROP TABLE IF EXISTS pc_respuestas;
  `);
}


export async function down(knex) {

  /*
   * No recreamos las tablas automáticamente porque fueron
   * declaradas obsoletas y no queremos reconstruir una estructura
   * incorrecta.
   *
   * Para restaurarlas se deben ejecutar nuevamente las migraciones
   * originales de cada tabla.
   */

}