// migrations/20260823_adjust_horarios_to_connection_id.js

export async function up(knex) {

  /*
   * ============================================================
   * 1. ELIMINAR FK ACTUALES
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS fk_horario_base_local;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS fk_horario_especial_local;
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
   * 2. ELIMINAR UNIQUE ACTUALES
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS
    local_horarios_base_codlocal_dia_semana_empresa_key;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS
    local_horarios_especiales_codlocal_fecha_key;
  `);


  /*
   * ============================================================
   * 3. AGREGAR connection_id
   * ============================================================
   */

  await knex.schema.alterTable("local_horarios_base", table => {
    table.integer("connection_id").nullable();
  });

  await knex.schema.alterTable("local_horarios_especiales", table => {
    table.integer("connection_id").nullable();
  });


  /*
   * ============================================================
   * 4. POBLAR connection_id
   * ============================================================
   *
   * Aprovechamos empresa_id + codlocal antes de eliminar
   * empresa_id.
   */

  await knex.raw(`
    UPDATE local_horarios_base h
    SET connection_id = c.id
    FROM connections c
    WHERE c.empresa_id = h.empresa_id
      AND c."codLocal" = h.codlocal;
  `);

  await knex.raw(`
    UPDATE local_horarios_especiales h
    SET connection_id = c.id
    FROM connections c
    WHERE c.empresa_id = h.empresa_id
      AND c."codLocal" = h.codlocal;
  `);


  /*
   * ============================================================
   * 5. VALIDAR REGISTROS SIN CONEXIÓN
   * ============================================================
   */

  const baseSinConnection = await knex("local_horarios_base")
    .whereNull("connection_id")
    .count("* as total")
    .first();

  if (Number(baseSinConnection.total) > 0) {
    throw new Error(
      `Existen ${baseSinConnection.total} registros en local_horarios_base sin connection_id.`
    );
  }

  const especialesSinConnection =
    await knex("local_horarios_especiales")
      .whereNull("connection_id")
      .count("* as total")
      .first();

  if (Number(especialesSinConnection.total) > 0) {
    throw new Error(
      `Existen ${especialesSinConnection.total} registros en local_horarios_especiales sin connection_id.`
    );
  }


  /*
   * ============================================================
   * 6. HACER connection_id NOT NULL
   * ============================================================
   */

  await knex.schema.alterTable("local_horarios_base", table => {
    table.integer("connection_id").notNullable().alter();
  });

  await knex.schema.alterTable("local_horarios_especiales", table => {
    table.integer("connection_id").notNullable().alter();
  });


  /*
   * ============================================================
   * 7. CREAR FK HACIA connections.id
   * ============================================================
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    ADD CONSTRAINT fk_horario_base_connection
    FOREIGN KEY (connection_id)
    REFERENCES connections(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    ADD CONSTRAINT fk_horario_especial_connection
    FOREIGN KEY (connection_id)
    REFERENCES connections(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);


  /*
   * ============================================================
   * 8. NUEVAS RESTRICCIONES UNIQUE
   * ============================================================
   *
   * Un local solo puede tener un horario base por día.
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    ADD CONSTRAINT
    local_horarios_base_connection_dia_semana_key
    UNIQUE (connection_id, dia_semana);
  `);


  /*
   * Un local solo puede tener un horario especial por fecha.
   */

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    ADD CONSTRAINT
    local_horarios_especiales_connection_fecha_key
    UNIQUE (connection_id, fecha);
  `);


  /*
   * ============================================================
   * 9. ELIMINAR ÍNDICES ANTIGUOS
   * ============================================================
   */

  await knex.raw(`
    DROP INDEX IF EXISTS idx_horario_base_empresa_codlocal;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS idx_horario_especial_empresa_codlocal;
  `);


  /*
   * ============================================================
   * 10. ELIMINAR empresa_id
   * ============================================================
   */

  await knex.schema.alterTable("local_horarios_base", table => {
    table.dropColumn("empresa_id");
  });

  await knex.schema.alterTable(
    "local_horarios_especiales",
    table => {
      table.dropColumn("empresa_id");
    }
  );


  /*
   * ============================================================
   * 11. CREAR ÍNDICES
   * ============================================================
   */

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS
    idx_horario_base_connection
    ON local_horarios_base (connection_id);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS
    idx_horario_especial_connection
    ON local_horarios_especiales (connection_id);
  `);
}


/*
 * ==============================================================
 * ROLLBACK
 * ==============================================================
 */

export async function down(knex) {

  /*
   * 1. AGREGAR empresa_id
   */

  await knex.schema.alterTable("local_horarios_base", table => {
    table.integer("empresa_id").nullable();
  });

  await knex.schema.alterTable(
    "local_horarios_especiales",
    table => {
      table.integer("empresa_id").nullable();
    }
  );


  /*
   * 2. RECUPERAR empresa_id DESDE connections
   */

  await knex.raw(`
    UPDATE local_horarios_base h
    SET empresa_id = c.empresa_id
    FROM connections c
    WHERE c.id = h.connection_id;
  `);

  await knex.raw(`
    UPDATE local_horarios_especiales h
    SET empresa_id = c.empresa_id
    FROM connections c
    WHERE c.id = h.connection_id;
  `);


  /*
   * 3. ELIMINAR UNIQUE NUEVOS
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS
    local_horarios_base_connection_dia_semana_key;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS
    local_horarios_especiales_connection_fecha_key;
  `);


  /*
   * 4. ELIMINAR FK NUEVAS
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    DROP CONSTRAINT IF EXISTS
    fk_horario_base_connection;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    DROP CONSTRAINT IF EXISTS
    fk_horario_especial_connection;
  `);


  /*
   * 5. ELIMINAR ÍNDICES NUEVOS
   */

  await knex.raw(`
    DROP INDEX IF EXISTS idx_horario_base_connection;
  `);

  await knex.raw(`
    DROP INDEX IF EXISTS idx_horario_especial_connection;
  `);


  /*
   * 6. ELIMINAR connection_id
   */

  await knex.schema.alterTable("local_horarios_base", table => {
    table.dropColumn("connection_id");
  });

  await knex.schema.alterTable(
    "local_horarios_especiales",
    table => {
      table.dropColumn("connection_id");
    }
  );


  /*
   * 7. empresa_id NOT NULL
   */

  await knex.schema.alterTable("local_horarios_base", table => {
    table.integer("empresa_id").notNullable().alter();
  });

  await knex.schema.alterTable(
    "local_horarios_especiales",
    table => {
      table.integer("empresa_id").notNullable().alter();
    }
  );


  /*
   * 8. RESTAURAR FK COMPUESTAS
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    ADD CONSTRAINT fk_horario_base_local
    FOREIGN KEY (empresa_id, codlocal)
    REFERENCES connections (empresa_id, "codLocal")
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    ADD CONSTRAINT fk_horario_especial_local
    FOREIGN KEY (empresa_id, codlocal)
    REFERENCES connections (empresa_id, "codLocal")
    ON UPDATE CASCADE
    ON DELETE CASCADE;
  `);


  /*
   * 9. RESTAURAR UNIQUE ANTERIORES
   */

  await knex.raw(`
    ALTER TABLE local_horarios_base
    ADD CONSTRAINT
    local_horarios_base_codlocal_dia_semana_empresa_key
    UNIQUE (codlocal, dia_semana, empresa_id);
  `);

  await knex.raw(`
    ALTER TABLE local_horarios_especiales
    ADD CONSTRAINT
    local_horarios_especiales_codlocal_fecha_key
    UNIQUE (codlocal, fecha);
  `);


  /*
   * 10. RESTAURAR ÍNDICES
   */

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS
    idx_horario_base_empresa_codlocal
    ON local_horarios_base (empresa_id, codlocal);
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS
    idx_horario_especial_empresa_codlocal
    ON local_horarios_especiales (empresa_id, codlocal);
  `);
}