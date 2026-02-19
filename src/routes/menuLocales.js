import express from "express";
import mgmtDb from "../db/adminDb.js";
import {allowRoles} from "../middleware/roleMiddleware.js";
import { requireAuth } from "../middleware/auth.js";
import { logMenuChange } from "../services/menuLogs.service.js";

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
            m."menuCritico",
            m.uber,
            m.rappi,
            m.pedya,
            m.justo
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
    // 1️⃣ Obtener valor actual
      const actual = await mgmtDb("menu_locales")
        .select("menuCritico")
        .where("idcodlocal", codLocal)
        .first();

      if (!actual) {
        return res.status(404).json({ error: "Local no encontrado" });
      }

      // 2️⃣ Actualizar valor
    await mgmtDb.raw(
      `
      UPDATE menu_locales
      SET "menuCritico" = ?, updated_at = now()
      WHERE idcodlocal = ?
      `,
      [menuCritico, codLocal]
    );

    // 3️⃣ Log automático
    await logMenuChange({
      entidad: "menu_local",
      entidadId: codLocal,
      campo: "menuCritico",
      valorAnterior: actual?.menuCritico,
      valorNuevo: menuCritico,
      usuario: req.user.username,
      rol: req.user.role
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando menuCritico" });
  }
});

router.post("/agregar",allowRoles("Admin"),async (req, res) => {
    try {
      const {
        codLocal,
        menuOrigen,
        menuCritico,
        uber,
        rappi,
        pedya,
        justo
      } = req.body;

      if (!codLocal || !menuOrigen) {
        return res.status(400).json({ error: "Datos obligatorios incompletos" });
      }

      // 1️⃣ Validar que el local exista en connections
      const localExiste = await mgmtDb("connections")
        .where("codLocal", codLocal)
        .first();

      if (!localExiste) {
        return res.status(404).json({ error: "El local no existe en connections" });
      }

      // 2️⃣ Validar que NO exista ya en menu_locales
      const menuExiste = await mgmtDb("menu_locales")
        .where("idcodlocal", codLocal)
        .first();

      if (menuExiste) {
        return res.status(409).json({ error: "El menú ya existe para este local" });
      }

      // 3️⃣ Insertar menú
      await mgmtDb("menu_locales").insert({
        idcodlocal: codLocal,
        menuOrigen,
        menuCritico,
        uber: uber || null,
        rappi: rappi || null,
        pedya: pedya || null,
        justo: justo || null
      });

      res.json({ ok: true, message: "Menú creado correctamente" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error creando menú del local" });
    }
  }
);

//Esta ruta alimenta el botón/modal
router.get("/locales-disponibles",allowRoles("Admin"),
  async (req, res) => {
    try {
      const locales = await mgmtDb("connections as c")
        .leftJoin("menu_locales as ml", "ml.idcodlocal", "c.codLocal")
        .whereNull("ml.idcodlocal")
        .select(
          "c.codLocal",
          "c.name"
        )
        .orderBy("c.name");

      res.json(locales);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error obteniendo locales disponibles" });
    }
  }
);


export default router;
