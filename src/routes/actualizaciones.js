import express from "express";
import { enviarCorreoAlerta } from "../services/mailService.js";
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

function obtenerDiaSemana() {
  // JS: domingo=0 ... sábado=6
  // Nosotros: lunes=1 ... domingo=7

  const dia = new Date().getDay();

  return dia === 0 ? 7 : dia;
}

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

    /* CONSULTA */

    const result = await pool.request().query(`
      SELECT e.Local AS codLocal, l.Nom_local,
        CASE
          WHEN MAX(e.fecha) < CAST(GETDATE() AS DATE)
            THEN 'Sin ventas hoy'
          WHEN DATEDIFF(
            MINUTE,
            MAX(
              DATEADD(
                SECOND,
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
              DATEADD(
                SECOND,
                DATEDIFF(SECOND,'00:00:00',e.hora),
                CAST(e.fecha AS DATETIME)
              )
            ),
            GETDATE()
          ) BETWEEN 11 AND 59
            THEN 'Demora leve'
          ELSE 'Critica'
        END AS estado

      FROM emitidos e LEFT JOIN locales l ON e.Local = l.Num_local
      WHERE e.anulado = 0 
      GROUP BY e.Local, l.Nom_local
      ORDER BY
        estado,
        l.Nom_local
    `);

    
    let data = result.recordset;
    
    /* VALIDAR LOCALES CERRADOS  */
    const diaSemana = obtenerDiaSemana();

    const localesSinVentas = data
      .filter(x => x.estado === "Sin ventas hoy")
      .map(x => String(x.codLocal));

    if (localesSinVentas.length > 0) {

      const horarios = await mgmtDb("local_horarios_base")
        .select("codlocal")
        .where({
          dia_semana: diaSemana,
          activo: true,
          cerrado: true
        })
        .whereIn("codlocal", localesSinVentas);
        

      const localesCerrados = new Set(
        horarios.map(h => String(h.codlocal))
      );

      data = data.map(local => {

        if (
          local.estado === "Sin ventas hoy" &&
          localesCerrados.has(String(local.codLocal))
        ) {

          return {
            ...local,
            estado: "Cerrado"
          };

        }

        return local;

      });

    }

    /* ALERTAS */
    const alertas = data.filter(x =>
      x.estado === "Critica" ||
      x.estado === "Sin ventas hoy"
    );

    /* RESUMEN PARA DASHBOARD */

    const resumen = Object.values(
      data.reduce((acc, item) => {
        if (!acc[item.estado]) {
          acc[item.estado] = {
            estado: item.estado,
            cantidad: 0
          };
        }

        acc[item.estado].cantidad++;
        return acc;
      }, {})
    );
    

    /* RESPUESTA API */

    res.json({
      total: data.length,
      alertas: alertas.length,
      resumen,
      data

    });

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


//Estado de servicio deliverhub - POST para que los locales envíen su respuesta
router.post("/deliverhub", async (req, res) => {
  /* VALIDAR API KEY */
    const apiKey = req.headers["x-api-key"];

    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({
        error: "No autorizado"
      });
    }

  try {
    const {
      codlocal,
      respuesta
    } = req.body;

    if (!codlocal || !respuesta) {
      return res.status(400).json({
        error: "codlocal y respuesta son requeridos"
      });
    }

    // 🔥 Validar local existente
    const local = await db("connections")
      .where({ codLocal: codlocal })
      .first();

    if (!local) {
      return res.status(404).json({
        error: "Local no encontrado"
      });
    }

    const [row] = await db("pc_respuestas")
      .insert({
        codlocal,
        respuesta
      })
      .returning("*");

    res.status(201).json({
      ok: true,
      data: row
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error guardando respuesta"
    });
  }
});

/* LISTAR RESPUESTAS */

router.get("/deliverhub", async (req, res) => {

  try {

    const data = await db("pc_respuestas as p")
      .join("connections as c", "c.codLocal", "p.codlocal")
      .select(
        "p.id",
        "p.codlocal",
        "c.name as local",
        "p.respuesta",
        "p.leido",
        "p.created_at"
      )
      .orderBy("p.created_at", "desc");

    res.json(data);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error obteniendo respuestas"
    });
  }
});

/* MARCAR LEIDO */

router.put("/deliverhub/leido/:id", async (req, res) => {
  try {
    await db("pc_respuestas")
      .where({ id: req.params.id })
      .update({
        leido: true
      });

    res.json({
      ok: true
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error actualizando"
    });
  }
});

export default router;