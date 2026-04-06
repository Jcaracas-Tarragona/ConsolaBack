import express from "express";
import mgmtDb from "../db/adminDB.js";
import  {getCentralPool }  from "../db/dbCentral.js";
const router = express.Router();


function parseFecha(fecha) {
  const f = new Date(fecha);
  if (!isNaN(f)) return f;

  // fallback simple para formato Windows
  const partes = fecha.split(" ");
  if (partes.length >= 2) {
    const [d, m, y] = partes[0].split("-");
    return new Date(`${y}-${m}-${d} ${partes[1]}`);
  }

  return null;
}
/* 
curl -X POST "http://tu-api.local/actualizaciones" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: kjhlkjhljkhlkjhlkjhlkjh" ^
  -d "{\"equipo\":\"%COMPUTERNAME%\",\"modulo\":\"ACTPTOVENTA\",\"estado\":\"actualizado\",\"fecha\":\"%date% %time%\"}"
*/

router.post("/", async (req, res) => {

  try {

    /* VALIDAR API KEY */
    const apiKey = req.headers["x-api-key"];

    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        error: "No autorizado"
      });
    }

    /* =========================
       DATA
    ========================== */
    const { equipo, modulo, estado, fecha } = req.body;

    if (!equipo || !modulo || !estado || !fecha) {
      return res.status(400).json({
        error: "Datos incompletos"
      });
    }

    const fechaParseada = parseFecha(fecha);

    if (isNaN(fechaParseada)) {
      return res.status(400).json({
        error: "Fecha inválida"
      });
    }

    /* =========================
       INSERT BD
    ========================== */
    await mgmtDb("actualizaciones").insert({
      equipo,
      modulo,
      estado,
      fecha: fechaParseada,
      ip: req.ip
    });

    res.json({
      ok: true,
      message: "Actualización registrada"
    });

  } catch (err) {

    console.error("❌ Error:", err);

    res.status(500).json({
      error: "Error interno"
    });

  }

});

router.get("/estado-equipos", async (req, res) => {
  try {

    const result = await mgmtDb.raw(`
      SELECT DISTINCT ON (equipo, modulo)
        equipo,
        modulo,
        estado,
        fecha,
        ip
      FROM actualizaciones
      ORDER BY equipo, modulo, fecha DESC
    `);

    const rows = result.rows;

    // 🔥 Agrupar por equipo
    const agrupado = rows.reduce((acc, row) => {
      if (!acc[row.equipo]) {
        acc[row.equipo] = {
          equipo: row.equipo,
          modulos: []
        };
      }

      acc[row.equipo].modulos.push({
        modulo: row.modulo,
        estado: row.estado,
        fecha: row.fecha,
        ip: row.ip
      });

      return acc;
    }, {});

    res.json(Object.values(agrupado));

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo estado"
    });
  }
});

router.get("/estado-horario/resumen", async (req, res) => {
  /* VALIDAR API KEY */
  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: "No autorizado"
    });
  }
  
  try {
    const pool = await getCentralPool();

    const result = await pool.request().query(`
      SELECT estado, COUNT(*) AS cantidad
      FROM (
        SELECT
          CASE
            WHEN MAX(e.fecha) < CAST(GETDATE() AS DATE)
              THEN 'Sin ventas hoy'
            WHEN DATEDIFF(
              MINUTE,
              MAX(
                DATEADD(SECOND,
                  DATEDIFF(SECOND,'00:00:00',e.hora),
                  CAST(e.fecha AS DATETIME)
                )
              ),
              GETDATE()
            ) <= 10
              THEN 'En horario'
            WHEN DATEDIFF(
              MINUTE,
              MAX(
                DATEADD(SECOND,
                  DATEDIFF(SECOND,'00:00:00',e.hora),
                  CAST(e.fecha AS DATETIME)
                )
              ),
              GETDATE()
            ) BETWEEN 11 AND 59
              THEN 'Demora leve'
            ELSE 'Critica'
          END AS estado
        FROM emitidos e
        LEFT JOIN locales l ON e.Local = l.Num_local
        WHERE e.anulado = 0
        GROUP BY e.Local, l.Nom_local
      ) AS sub
      GROUP BY estado
      ORDER BY estado;
    `);
      
    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error generando resumen de estados"
    });
  }
});

// Carga masiva de tickets
router.post("/zendesks/bulk", async (req, res) => {

  /* VALIDAR API KEY */
    const apiKey = req.headers["x-api-key"];

    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        error: "No autorizado"
      });
    }
    
  try {
    const tickets = req.body;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ error: "Array requerido" });
    }

    const data = tickets.map(t => ({
      ticket_id: t.ticket_id,
      zd_created_at: t.created_at,
      zd_updated_at: t.updated_at,
      status: t.status,
      codigo_local: t.codigo_local,
      tipo_ticket: t.tipo_ticket,
      tipo_consulta: t.tipo_consulta,
      tipo_servicio: t.tipo_servicio,
      requerimiento_completado: t.requerimiento_completado
    }));

    await mgmtDb("zendesks")
      .insert(data)
      .onConflict("ticket_id")
      .merge();

    res.json({
      ok: true,
      total: data.length
    });

  } catch (error) {
    console.error("ERROR BULK ZENDESK:", error);
    res.status(500).json({ error: "Error carga masiva" });
  }
});

export default router;