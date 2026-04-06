// routes/zendesk.js
import express from "express";
import db from "../db/adminDB.js";


const router = express.Router();

// Endpoint para recibir tickets desde el cliente (upsert)
router.post("/zendesks", async (req, res) => {
  try {
    const {
      ticket_id,
      created_at,
      updated_at,
      status,
      codigo_local,
      tipo_ticket,
      tipo_consulta,
      tipo_servicio,
      requerimiento_completado
    } = req.body;

    if (!ticket_id || !created_at || !status || !codigo_local) {
      return res.status(400).json({ error: "Campos obligatorios faltantes" });
    }

    const data = {
      ticket_id,
      zd_created_at: created_at,
      zd_updated_at: updated_at,
      status,
      codigo_local,
      tipo_ticket,
      tipo_consulta,
      tipo_servicio,
      requerimiento_completado
    };

    // 🔥 UPSERT (PostgreSQL)
    const result = await db("zendesks")
      .insert(data)
      .onConflict("ticket_id")
      .merge()
      .returning("id");

    res.json({ ok: true, id: result[0] });

  } catch (error) {
    console.error("ERROR ZENDESK:", error);
    res.status(500).json({ error: "Error guardando ticket" });
  }
});


router.get("/local/:codigo_local", async (req, res) => {
  try {
    const { codigo_local } = req.params;
    const { status, desde, hasta } = req.query;
    const codLocal = parseInt(codigo_local);
    
    let query = db("zendesks").where({ codigo_local: codLocal });

    // 🔍 filtro por estado
    if (status) {
      query = query.andWhere("status", status);
    }

    // 📅 filtro por fechas
    if (desde) {
      query = query.andWhere("zd_created_at", ">=", `${desde} 00:00:00`);
    }

    if (hasta) {
      query = query.andWhere("zd_created_at", "<=", `${hasta} 23:59:59`);
    }

    const data = await query.orderBy("zd_created_at", "desc");
    
    res.json(data);

  } catch (error) {
    console.error("ERROR GET ZENDESK LOCAL:", error);
    res.status(500).json({ error: "Error obteniendo tickets" });
  }
});

export default router;
