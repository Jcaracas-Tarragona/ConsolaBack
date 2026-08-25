/**
 * Migración:
 *
 * Elimina codlocal de:
 * - local_horarios_base
 * - local_horarios_especiales
 *
 * Las relaciones pasan definitivamente a:
 *
 * connection_id -> connections.id
 *
 * Las vistas siguen exponiendo codlocal para mantener
 * compatibilidad con frontend, Excel y reportes.
 */

export async function up(knex) {

  /*
   * ============================================================
   * 1. ELIMINAR VISTAS DEPENDIENTES
   * ============================================================
   *
   * Orden importante:
   *
   * vw_horarios_unificados depende de vw_horarios_base_agrupados.
   */

  await knex.raw(`
    DROP VIEW IF EXISTS vw_horarios_unificados;
  `);

  await knex.raw(`
    DROP VIEW IF EXISTS vw_horarios_base_agrupados;
  `);

  await knex.raw(`
    DROP VIEW IF EXISTS vw_horarios_especiales;
  `);


  /*
   * ============================================================
   * 2. ELIMINAR codlocal DE TABLAS DE HORARIOS
   * ============================================================
   */

  await knex.schema.alterTable(
    "local_horarios_base",
    (table) => {
      table.dropColumn("codlocal");
    }
  );

  await knex.schema.alterTable(
    "local_horarios_especiales",
    (table) => {
      table.dropColumn("codlocal");
    }
  );


  /*
   * ============================================================
   * 3. RECREAR vw_horarios_base_agrupados
   * ============================================================
   *
   * ANTES:
   *
   * hb.codlocal -> connections.codLocal
   *
   * AHORA:
   *
   * hb.connection_id -> connections.id
   *
   * codlocal se obtiene desde connections.
   */

  await knex.raw(`
    CREATE VIEW vw_horarios_base_agrupados AS

    WITH base AS (

      SELECT

        hb.connection_id,

        l.empresa_id,

        l."codLocal" AS codlocal,

        l.name AS nombre_local,

        ml."menuOrigen",

        ml."menuCritico",

        hb.hora_apertura,

        hb.hora_cierre,

        hb.cerrado,

        hb.activo,

        hb.dia_semana,

        hb.dia_semana AS dia_orden,

        CASE hb.dia_semana

          WHEN 1 THEN 'Lun'::text
          WHEN 2 THEN 'Mar'::text
          WHEN 3 THEN 'Mié'::text
          WHEN 4 THEN 'Jue'::text
          WHEN 5 THEN 'Vie'::text
          WHEN 6 THEN 'Sáb'::text
          WHEN 7 THEN 'Dom'::text

          ELSE NULL::text

        END AS dia_txt

      FROM local_horarios_base hb

      INNER JOIN connections l
        ON l.id = hb.connection_id

      LEFT JOIN menu_locales ml
        ON ml.empresa_id = l.empresa_id
        AND ml.idcodlocal = l."codLocal"

      WHERE hb.activo = true

    )

    SELECT

      connection_id,

      empresa_id,

      codlocal,

      nombre_local,

      "menuOrigen",

      "menuCritico",

      string_agg(
        dia_txt,
        '–'::text
        ORDER BY dia_orden
      ) AS dias,

      hora_apertura,

      hora_cierre,

      cerrado,

      activo

    FROM base

    GROUP BY

      connection_id,

      empresa_id,

      codlocal,

      nombre_local,

      "menuOrigen",

      "menuCritico",

      hora_apertura,

      hora_cierre,

      cerrado,

      activo

    ORDER BY

      codlocal,

      hora_apertura;
  `);


  /*
   * ============================================================
   * 4. RECREAR vw_horarios_especiales
   * ============================================================
   *
   * Mantenemos exactamente la finalidad actual de la vista.
   *
   * codlocal ahora se obtiene desde connections.
   */

  await knex.raw(`
    CREATE VIEW vw_horarios_especiales AS

    SELECT

      l."codLocal" AS codlocal,

      ml."menuOrigen",

      ml."menuCritico",

      he.fecha,

      he.cerrado,

      he.hora_apertura,

      he.hora_cierre,

      he.motivo

    FROM local_horarios_especiales he

    INNER JOIN connections l
      ON l.id = he.connection_id

    LEFT JOIN menu_locales ml
      ON ml.empresa_id = l.empresa_id
      AND ml.idcodlocal = l."codLocal";
  `);


  /*
   * ============================================================
   * 5. RECREAR vw_horarios_unificados
   * ============================================================
   *
   * Esta vista sigue entregando:
   *
   * codlocal
   * nombre_local
   * menuOrigen
   * menuCritico
   * fecha
   * dias
   * horarios
   * estado
   * tipo_horario
   * f_solicitud
   *
   * Además agregamos:
   *
   * connection_id
   * empresa_id
   */

  await knex.raw(`
    CREATE VIEW vw_horarios_unificados AS

    SELECT

      b.connection_id,

      b.empresa_id,

      b.codlocal,

      b.nombre_local,

      b."menuOrigen",

      b."menuCritico",

      NULL::date AS fecha,

      b.dias,

      b.hora_apertura,

      b.hora_cierre,

      b.cerrado,

      b.activo,

      'BASE'::text AS tipo_horario,

      NULL::timestamp without time zone AS f_solicitud

    FROM vw_horarios_base_agrupados b


    UNION ALL


    SELECT

      e.connection_id,

      l.empresa_id,

      l."codLocal" AS codlocal,

      l.name AS nombre_local,

      ml."menuOrigen",

      ml."menuCritico",

      e.fecha,

      to_char(
        e.fecha::timestamp with time zone,
        'DD Mon YYYY'::text
      ) AS dias,

      e.hora_apertura,

      e.hora_cierre,

      e.cerrado,

      e.activo,

      'ESPECIAL'::text AS tipo_horario,

      e.created_at AS f_solicitud

    FROM local_horarios_especiales e

    INNER JOIN connections l
      ON l.id = e.connection_id

    LEFT JOIN menu_locales ml
      ON ml.empresa_id = l.empresa_id
      AND ml.idcodlocal = l."codLocal"

    WHERE

      e.activo = true

      AND e.fecha >= CURRENT_DATE;
  `);

}


/*
 * ==============================================================
 * DOWN
 * ==============================================================
 */

export async function down(knex) {

  /*
   * ============================================================
   * 1. ELIMINAR VISTAS NUEVAS
   * ============================================================
   */

  await knex.raw(`
    DROP VIEW IF EXISTS vw_horarios_unificados;
  `);

  await knex.raw(`
    DROP VIEW IF EXISTS vw_horarios_base_agrupados;
  `);

  await knex.raw(`
    DROP VIEW IF EXISTS vw_horarios_especiales;
  `);


  /*
   * ============================================================
   * 2. RESTAURAR codlocal
   * ============================================================
   */

  await knex.schema.alterTable(
    "local_horarios_base",
    (table) => {
      table.integer("codlocal").nullable();
    }
  );

  await knex.schema.alterTable(
    "local_horarios_especiales",
    (table) => {
      table.integer("codlocal").nullable();
    }
  );


  /*
   * ============================================================
   * 3. RECUPERAR codlocal DESDE connections
   * ============================================================
   */

  await knex.raw(`
    UPDATE local_horarios_base h

    SET codlocal = c."codLocal"

    FROM connections c

    WHERE c.id = h.connection_id;
  `);


  await knex.raw(`
    UPDATE local_horarios_especiales h

    SET codlocal = c."codLocal"

    FROM connections c

    WHERE c.id = h.connection_id;
  `);


  /*
   * ============================================================
   * 4. VOLVER codlocal NOT NULL
   * ============================================================
   */

  await knex.schema.alterTable(
    "local_horarios_base",
    (table) => {

      table
        .integer("codlocal")
        .notNullable()
        .alter();

    }
  );


  await knex.schema.alterTable(
    "local_horarios_especiales",
    (table) => {

      table
        .integer("codlocal")
        .notNullable()
        .alter();

    }
  );


  /*
   * ============================================================
   * 5. RESTAURAR vw_horarios_base_agrupados ORIGINAL
   * ============================================================
   */

  await knex.raw(`
    CREATE VIEW vw_horarios_base_agrupados AS

    WITH base AS (

      SELECT

        hb.codlocal,

        l.name AS nombre_local,

        ml."menuOrigen",

        ml."menuCritico",

        hb.hora_apertura,

        hb.hora_cierre,

        hb.cerrado,

        hb.activo,

        hb.dia_semana,

        hb.dia_semana AS dia_orden,

        CASE hb.dia_semana

          WHEN 1 THEN 'Lun'::text
          WHEN 2 THEN 'Mar'::text
          WHEN 3 THEN 'Mié'::text
          WHEN 4 THEN 'Jue'::text
          WHEN 5 THEN 'Vie'::text
          WHEN 6 THEN 'Sáb'::text
          WHEN 7 THEN 'Dom'::text

          ELSE NULL::text

        END AS dia_txt

      FROM local_horarios_base hb

      JOIN connections l
        ON l."codLocal" = hb.codlocal

      JOIN menu_locales ml
        ON ml.idcodlocal = hb.codlocal

      WHERE hb.activo = true

    )

    SELECT

      codlocal,

      nombre_local,

      "menuOrigen",

      "menuCritico",

      string_agg(
        dia_txt,
        '–'::text
        ORDER BY dia_orden
      ) AS dias,

      hora_apertura,

      hora_cierre,

      cerrado,

      activo

    FROM base

    GROUP BY

      codlocal,

      nombre_local,

      "menuOrigen",

      "menuCritico",

      hora_apertura,

      hora_cierre,

      cerrado,

      activo

    ORDER BY

      codlocal,

      hora_apertura;
  `);


  /*
   * ============================================================
   * 6. RESTAURAR vw_horarios_especiales ORIGINAL
   * ============================================================
   */

  await knex.raw(`
    CREATE VIEW vw_horarios_especiales AS

    SELECT

      he.codlocal,

      ml."menuOrigen",

      ml."menuCritico",

      he.fecha,

      he.cerrado,

      he.hora_apertura,

      he.hora_cierre,

      he.motivo

    FROM local_horarios_especiales he

    JOIN menu_locales ml
      ON ml.idcodlocal = he.codlocal;
  `);


  /*
   * ============================================================
   * 7. RESTAURAR vw_horarios_unificados ORIGINAL
   * ============================================================
   */

  await knex.raw(`
    CREATE VIEW vw_horarios_unificados AS

    SELECT

      b.codlocal,

      b.nombre_local,

      b."menuOrigen",

      b."menuCritico",

      NULL::date AS fecha,

      b.dias,

      b.hora_apertura,

      b.hora_cierre,

      b.cerrado,

      b.activo,

      'BASE'::text AS tipo_horario,

      NULL::timestamp without time zone AS f_solicitud

    FROM vw_horarios_base_agrupados b


    UNION ALL


    SELECT

      e.codlocal,

      l.name AS nombre_local,

      ml."menuOrigen",

      ml."menuCritico",

      e.fecha,

      to_char(
        e.fecha::timestamp with time zone,
        'DD Mon YYYY'::text
      ) AS dias,

      e.hora_apertura,

      e.hora_cierre,

      e.cerrado,

      e.activo,

      'ESPECIAL'::text AS tipo_horario,

      e.created_at AS f_solicitud

    FROM local_horarios_especiales e

    JOIN connections l
      ON l."codLocal" = e.codlocal

    JOIN menu_locales ml
      ON ml.idcodlocal = e.codlocal

    WHERE

      e.activo = true

      AND e.fecha >= CURRENT_DATE;
  `);

}