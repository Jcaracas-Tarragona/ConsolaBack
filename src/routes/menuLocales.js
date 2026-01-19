import express from "express";
import mgmtDb from "../db/adminDb.js";
import {allowRoles} from "../middleware/roleMiddleware.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

//router.use(requireAuth);
/**
 * GET → listado de locales + menú
 */


router.get("/", async (req, res) => {
  
  try {
    const r = await mgmtDb.raw(`
      SELECT 
            c."codLocal",
            c.name AS local,
            m."menuOrigen",
            m."menuCritico"
        FROM connections c
        INNER JOIN menu_locales m 
            ON m.idcodlocal = c."codLocal"
        ORDER BY c.name
    `);

    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo menuLocales" });
  }
});

/**
 * PATCH → actualizar menuCritico
 */
router.patch("/:codLocal", allowRoles("Admin", "Comercial"),async (req, res) => {
  const { codLocal } = req.params;
  const { menuCritico } = req.body;

  if (typeof menuCritico !== "boolean") {
    return res.status(400).json({ error: "menuCritico debe ser boolean" });
  }

  try {
    await mgmtDb.raw(
      `
      UPDATE menu_locales
      SET "menuCritico" = ?, updated_at = now()
      WHERE idcodlocal = ?
      `,
      [menuCritico, codLocal]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando menuCritico" });
  }
});

export default router;
