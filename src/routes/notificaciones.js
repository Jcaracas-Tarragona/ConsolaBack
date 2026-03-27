import express from "express";
import mgmtDb from "../db/adminDb.js";
const router = express.Router();

router.get("/notificaciones", async (req, res) => {
  try {
    const data = await mgmtDb("notificaciones")
      .where({ leido: false })
      .orderBy("created_at", "desc");

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo notificaciones" });
  }
});

router.put("/notificaciones/:id/leido", async (req, res) => {
  try {
    const { id } = req.params;

    await db("notificaciones")
      .where({ id })
      .update({ leido: true });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Error actualizando notificación" });
  }
});

export default router;