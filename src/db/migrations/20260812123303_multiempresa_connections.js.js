export async function up(knex) {

  /*
   * ============================================================
   * 1. ELIMINAR FK ACTUALES
   * ============================================================
   *
   * Estas FK dependen de:
   *
   * connections.CodigoLocal
   *
   * y posteriormente serán reemplazadas por FK compuestas.
   */

  await knex.raw(`
    ALTER TABLE menu_locales
    DROP CONSTRAINT IF EXISTS fk_menu_locales_codlocal;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS fk_horario_base_local;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS fk_horario_especial_local;
  `);


  /*
   * ============================================================
   * 2. AGREGAR empresa_id
   * ============================================================
   */

  await knex.schema.alterTable("menu_locales", table => {
    table.integer("empresa_id").nullable();
  });

  await knex.schema.alterTable("local_horarios_base", table => {
    table.integer("empresa_id").nullable();
  });

  await knex.schema.alterTable("local_horarios_especiales", table => {
    table.integer("empresa_id").nullable();
  });


  /*
   * ============================================================
   * 3. ASIGNAR EMPRESA ACTUAL
   * ============================================================
   *
   * Todos los registros existentes pertenecen a Tarragona.
   *
   * empresa_id = 2
   */

  await knex("menu_locales")
    .update({ empresa_id: 2 });

  await knex("local_horarios_base")
    .update({ empresa_id: 2 });

  await knex("local_horarios_especiales")
    .update({ empresa_id: 2 });


  /*
   * ============================================================
   * 4. HACER empresa_id NOT NULL
   * ============================================================
   */

  await knex.schema.alterTable("menu_locales", table => {
    table.integer("empresa_id").notNullable().alter();
  });

  await knex.schema.alterTable("local_horarios_base", table => {
    table.integer("empresa_id").notNullable().alter();
  });

  await knex.schema.alterTable("local_horarios_especiales", table => {
    table.integer("empresa_id").notNullable().alter();
  });


  /*
   * ============================================================
   * 5. ELIMINAR CodigoLocal ORIGINAL
   * ============================================================
   *
   * Ahora ya no existen las FK de Zendesk ni PC_respuestas,
   * porque esas tablas fueron eliminadas en la migración anterior.
   *
   * Las FK restantes también fueron eliminadas arriba.
   */

  await knex.raw(`
    ALTER TABLE connections
    DROP CONSTRAINT IF EXISTS "CodigoLocal";
  `);


  /*
   * ============================================================
   * 6. CREAR NUEVO CodigoLocal
   * ============================================================
   *
   * Ahora codLocal es único POR EMPRESA.
   *
   * Ejemplo:
   *
   * empresa_id | codLocal
   * ---------------------
   * 2          | 418       OK
   * 3          | 418       OK
   *
   * Pero:
   *
   * 2          | 418
   * 2          | 418       NO permitido
   */

  await knex.raw(`
    ALTER TABLE connections
    ADD CONSTRAINT "CodigoLocal"
    UNIQUE (empresa_id, "codLocal");
  `);


  /*
   * ============================================================
   * 7. FK menu_locales
   * ============================================================
   *
   * menu_locales utiliza:
   *
   *   idcodlocal
   *
   * Por lo tanto:
   *
   * empresa_id + idcodlocal
   *
   * referencia:
   *
   * empresa_id + codLocal
   */

  await knex.raw(`
    ALTER TABLE menu_locales
    ADD CONSTRAINT fk_menu_locales_codlocal
    FOREIGN KEY (empresa_id, idcodlocal)
    REFERENCES connections (empresa_id, "codLocal")
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);


  /*
   * ============================================================
   * 8. FK local_horarios_base
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    ADD CONSTRAINT fk_horario_base_local
    FOREIGN KEY (empresa_id, codlocal)
    REFERENCES connections (empresa_id, "codLocal")
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);


  /*
   * ============================================================
   * 9. FK local_horarios_especiales
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    ADD CONSTRAINT fk_horario_especial_local
    FOREIGN KEY (empresa_id, codlocal)
    REFERENCES connections (empresa_id, "codLocal")
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);


  /*
   * ============================================================
   * 10. FK empresa_id -> empresas.id
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE menu_locales
    ADD CONSTRAINT fk_menu_locales_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_base
    ADD CONSTRAINT fk_horario_base_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    ADD CONSTRAINT fk_horario_especial_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES empresas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
  `);


  /*
   * ============================================================
   * 11. ÍNDICES
   * ============================================================
   */

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_menu_locales_empresa_codlocal
    ON menu_locales (empresa_id, idcodlocal);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_horario_base_empresa_codlocal
    ON local_horarios_base (empresa_id, codlocal);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_horario_especial_empresa_codlocal
    ON local_horarios_especiales (empresa_id, codlocal);
  `);
}


export async function down(knex) {

  /*
   * ============================================================
   * ELIMINAR FK COMPUESTAS
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE menu_locales
    DROP CONSTRAINT IF EXISTS fk_menu_locales_codlocal;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS fk_horario_base_local;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS fk_horario_especial_local;
  `);


  /*
   * ============================================================
   * ELIMINAR FK EMPRESA
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE menu_locales
    DROP CONSTRAINT IF EXISTS fk_menu_locales_empresa;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS fk_horario_base_empresa;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS fk_horario_especial_empresa;
  `);


  /*
   * ============================================================
   * ELIMINAR ÍNDICES
   * ============================================================
   */

  await knex.raw(`
    DROP INDEX IF EXISTS idx_menu_locales_empresa_codlocal;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS idx_horario_base_empresa_codlocal;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS idx_horario_especial_empresa_codlocal;
  `);


  /*
   * ============================================================
   * RESTAURAR CodigoLocal
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE connections
    DROP CONSTRAINT IF EXISTS "CodigoLocal";
  `);

  await knex.raw(`
    ALTER TABLE connections
    ADD CONSTRAINT "CodigoLocal"
    UNIQUE ("codLocal");
  `);


  /*
   * ============================================================
   * ELIMINAR empresa_id
   * ============================================================
   */

  await knex.schema.alterTable("menu_locales", table => {
    table.dropColumn("empresa_id");
  });

  await knex.schema.alterTable("local_horarios_base", table => {
    table.dropColumn("empresa_id");
  });

  await knex.schema.alterTable("local_horarios_especiales", table => {
    table.dropColumn("empresa_id");
  });
}