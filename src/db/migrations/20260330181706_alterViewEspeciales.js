export async function up(knex) {

  // 🔥 1. Crear índice
  await knex.schema.alterTable("local_horarios_especiales", (table) => {
    table.index("created_at", "idx_lhe_created_at");
  });

  // 🔥 2. Reemplazar vista
  await knex.raw(`
    CREATE OR REPLACE VIEW vw_horarios_unificados AS

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
      NULL::timestamp AS f_solicitud

    FROM vw_horarios_base_agrupados b

    UNION ALL

    SELECT 
      e.codlocal,
      l.name AS nombre_local,
      ml."menuOrigen",
      ml."menuCritico",
      e.fecha,
      to_char(e.fecha::timestamp with time zone, 'DD Mon YYYY') AS dias,
      e.hora_apertura,
      e.hora_cierre,
      e.cerrado,
      e.activo,
      'ESPECIAL'::text AS tipo_horario,
      e.created_at AS f_solicitud

    FROM local_horarios_especiales e
    JOIN connections l ON l."codLocal" = e.codlocal
    JOIN menu_locales ml ON ml.idcodlocal = e.codlocal
    WHERE e.activo = true 
      AND e.fecha >= CURRENT_DATE;
  `);
}

export async function down(knex) {

  // 🔥 1. Eliminar índice
  await knex.schema.alterTable("local_horarios_especiales", (table) => {
    table.dropIndex("created_at", "idx_lhe_created_at");
  });

  // 🔥 2. Restaurar vista original
  await knex.raw(`
    CREATE OR REPLACE VIEW vw_horarios_unificados AS

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
      'BASE'::text AS tipo_horario

    FROM vw_horarios_base_agrupados b

    UNION ALL

    SELECT 
      e.codlocal,
      l.name AS nombre_local,
      ml."menuOrigen",
      ml."menuCritico",
      e.fecha,
      to_char(e.fecha::timestamp with time zone, 'DD Mon YYYY') AS dias,
      e.hora_apertura,
      e.hora_cierre,
      e.cerrado,
      e.activo,
      'ESPECIAL'::text AS tipo_horario

    FROM local_horarios_especiales e
    JOIN connections l ON l."codLocal" = e.codlocal
    JOIN menu_locales ml ON ml.idcodlocal = e.codlocal
    WHERE e.activo = true 
      AND e.fecha >= CURRENT_DATE;
  `);
}