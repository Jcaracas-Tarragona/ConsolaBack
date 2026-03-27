import express from "express";
import mgmtDb from "../db/adminDb.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.put("/leido/:id", allowRoles("Admin"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const updated = await mgmtDb("notificaciones")
      .where({ id })
      .update({ leido: true });

    if (!updated) {
      return res.status(404).json({ error: "No encontrado" });
    }

    res.json({ ok: true });

  } catch (error) {
    console.error("ERROR REAL:", error);
    res.status(500).json({ error: "Error actualizando notificación" });
  }
});

router.get("/", allowRoles("Admin"), async (req, res) => {
  try {
    const data = await mgmtDb("notificaciones")
      .where({ leido: false })
      .orderBy("created_at", "desc");

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo notificaciones" });
  }
});



export default router;