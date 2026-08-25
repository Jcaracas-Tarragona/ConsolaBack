import express from "express";
import mgmtDb from "../db/adminDb.js";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(requireAuth);

/* =========================================================
   GET /horarios-especiales
   ========================================================= */
router.get("/", allowRoles("Admin", "Comercial", "Zonal"), async (req, res) => {
  try {
    const rows = await mgmtDb("local_horarios_especiales as he")
      .join("connections as c", "c.id", "he.connection_id")
      .select(
        "he.id",
        "he.connection_id",
        "c.codLocal as codlocal",
        "c.name as local_nombre",
        "c.empresa_id",
        "he.fecha",
        "he.hora_apertura",
        "he.hora_cierre",
        "he.cerrado",
        "he.motivo",
        "he.activo"
      )
      .where("he.activo", true)
      .orderBy(["c.name", "he.fecha"]);

    const grouped = {};

    rows.forEach(r => {
      if (!grouped[r.connection_id]) {
        grouped[r.connection_id] = {
          connection_id: r.connection_id,
          codlocal: r.codlocal,
          local_nombre: r.local_nombre,
          empresa_id: r.empresa_id,
          especiales: []
        };
      }

      grouped[r.connection_id].especiales.push({
        id: r.id,
        fecha: r.fecha,
        hora_apertura: r.hora_apertura,
        hora_cierre: r.hora_cierre,
        cerrado: r.cerrado,
        motivo: r.motivo,
        activo: r.activo
      });
    });

    res.json(Object.values(grouped));

  } catch (err) {
    console.error("Error obteniendo horarios especiales:", err);
    res.status(500).json({ message: "Error obteniendo horarios especiales" });
  }
});


/* =========================================================
   GET /horarios-especiales/he/:connectionId
   ========================================================= */
router.get("/he/:connectionId", allowRoles("Admin", "Comercial", "Zonal"), async (req, res) => {
  const connectionId = Number(req.params.connectionId);

  if (!connectionId || Number.isNaN(connectionId)) {
    return res.status(400).json({ message: "Connection inválida" });
  }

  try {
    const rows = await mgmtDb("local_horarios_especiales as he")
      .join("connections as c", "c.id", "he.connection_id")
      .select(
        "he.id",
        "he.connection_id",
        "c.codLocal as codlocal",
        "c.name as local_nombre",
        "c.empresa_id",
        "he.fecha",
        "he.hora_apertura",
        "he.hora_cierre",
        "he.cerrado",
        "he.motivo",
        "he.activo"
      )
      .where("he.connection_id", connectionId)
      .orderBy("he.fecha");

    if (!rows.length) {
      return res.json([]);
    }

    const grouped = {
      connection_id: rows[0].connection_id,
      codlocal: rows[0].codlocal,
      local_nombre: rows[0].local_nombre,
      empresa_id: rows[0].empresa_id,
      especiales: rows.map(r => ({
        id: r.id,
        fecha: r.fecha,
        hora_apertura: r.hora_apertura,
        hora_cierre: r.hora_cierre,
        cerrado: r.cerrado,
        motivo: r.motivo,
        activo: r.activo
      }))
    };

    res.json([grouped]);

  } catch (err) {
    console.error("Error obteniendo horario especial:", err);
    res.status(500).json({ message: "Error obteniendo horarios especiales" });
  }
});


/* =========================================================
   POST /horarios-especiales
   Crear o reemplazar horario especial
   ========================================================= */
router.post("/", allowRoles("Admin", "Comercial", "Zonal"), async (req, res) => {
  let { connection_id, fecha, hora_apertura, hora_cierre, cerrado = false, motivo } = req.body;

  if (!connection_id || !fecha) {
    return res.status(400).json({ message: "Local y fecha son obligatorios" });
  }

  if (!cerrado) {
    if (!hora_apertura || !hora_cierre || hora_apertura >= hora_cierre) {
      return res.status(400).json({ message: "Horario inválido" });
    }
  } else {
    hora_apertura = null;
    hora_cierre = null;
  }

  try {
    const connection = await mgmtDb("connections")
      .where({ id: connection_id })
      .first();

    if (!connection) {
      return res.status(404).json({ message: "Local no encontrado" });
    }

    await mgmtDb("local_horarios_especiales")
      .insert({
        connection_id,
        fecha,
        hora_apertura,
        hora_cierre,
        cerrado,
        motivo,
        activo: true
      })
      .onConflict(["connection_id", "fecha"])
      .merge({
        hora_apertura,
        hora_cierre,
        cerrado,
        motivo,
        activo: true,
        created_at: mgmtDb.fn.now()
      });

    res.json({ message: "Horario especial guardado" });

  } catch (err) {
    console.error("Error guardando horario especial:", err);
    res.status(500).json({ message: "Error guardando horario especial" });
  }
});


/* =========================================================
   DELETE /horarios-especiales/:id
   Eliminación lógica
   ========================================================= */
router.delete("/:id", allowRoles("Admin"), async (req, res) => {
  try {
    const updated = await mgmtDb("local_horarios_especiales")
      .where({ id: req.params.id })
      .update({ activo: false });

    if (!updated) {
      return res.status(404).json({ message: "Horario especial no encontrado" });
    }

    res.json({ message: "Horario especial eliminado" });

  } catch (err) {
    console.error("Error eliminando horario especial:", err);
    res.status(500).json({ message: "Error eliminando horario especial" });
  }
});

export default router;