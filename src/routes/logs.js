// routes/logs.js
import express from "express";
import mgmtDb from "../db/adminDb.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);

// GET /logs?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&user=xyz
router.get("/", async (req, res) => {
  try {
    const { date_from, date_to, userFilter, localFilter } = req.query;
    const q = mgmtDb("logs").select("id", "created_at", "username", "action", "codLocal", "articuloCodigo", "valorActual", "requiereCorreccion", "campo", "valorNuevo").orderBy("created_at","desc");

  
    if (date_from) q.where("created_at", ">=", `${date_from} 00:00:00`);
    if (date_to) q.where("created_at", "<=", `${date_to} 23:59:59`);
    if (userFilter) q.where("username", userFilter);
    if (localFilter) q.where("codLocal", localFilter);

    const rows = await q.limit(1000);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener logs" });
  }
});

export default router;
