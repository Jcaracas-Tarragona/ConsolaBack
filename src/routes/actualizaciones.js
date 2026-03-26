import express from "express";
import mgmtDb from "../db/adminDb.js";
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

    /* =========================
       VALIDAR API KEY
    ========================== */
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

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error obteniendo estado"
    });
  }
});

export default router;