import express from "express";
import db from "../db/adminDb.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

/*
GET /estados
GET /estados?grupo=GESTION
GET /estados?grupo=GESTION_LOCAL
*/
router.get("/", allowRoles("Admin", "N1", "N2", "Gerente", "RRHH", "Comercial", "Zonal"), async (req, res) => {
  try {
    const { grupo } = req.query;

    const query = db("estados")
      .select( "id","codigo","nombre","grupo","orden","activo")
      .where("activo", true)
      .orderBy("grupo")
      .orderBy("orden");

    if (grupo) {
      query.where("grupo", String(grupo).toUpperCase());
    }

    const estados = await query;

    res.json(estados);

  } catch (error) {
    console.error("Error obteniendo estados:", error);

    res.status(500).json({
      error: "Error obteniendo estados"
    });
  }
});


/*
POST /estados
Solo Admin
*/
router.post("/", allowRoles("Admin"), async (req, res) => {
  try {
    let {
      codigo,
      nombre,
      grupo,
      orden = 0
    } = req.body;

    if (!codigo || !nombre || !grupo) {
      return res.status(400).json({
        error: "codigo, nombre y grupo son obligatorios"
      });
    }

    codigo = String(codigo)
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

    grupo = String(grupo)
      .trim()
      .toUpperCase();

    nombre = String(nombre).trim();

    const existente = await db("estados")
      .where({
        codigo,
        grupo
      })
      .first();

    if (existente) {
      return res.status(409).json({
        error: "El estado ya existe para este grupo"
      });
    }

    const [estado] = await db("estados")
      .insert({
        codigo,
        nombre,
        grupo,
        orden,
        activo: true,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .returning("*");

    res.status(201).json(estado);

  } catch (error) {
    console.error("Error creando estado:", error);

    res.status(500).json({
      error: "Error creando estado"
    });
  }
});


/*
PUT /estados/:id
*/
router.put("/:id", allowRoles("Admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre,
      orden,
      activo
    } = req.body;

    const estadoActual = await db("estados")
      .where({ id })
      .first();

    if (!estadoActual) {
      return res.status(404).json({
        error: "Estado no encontrado"
      });
    }

    const cambios = {
      updated_at: db.fn.now()
    };

    if (nombre !== undefined) {
      cambios.nombre = String(nombre).trim();
    }

    if (orden !== undefined) {
      cambios.orden = Number(orden);
    }

    if (activo !== undefined) {
      cambios.activo = Boolean(activo);
    }

    const [estado] = await db("estados")
      .where({ id })
      .update(cambios)
      .returning("*");

    res.json(estado);

  } catch (error) {
    console.error("Error actualizando estado:", error);

    res.status(500).json({
      error: "Error actualizando estado"
    });
  }
});


/*
DELETE lógico
No eliminamos estados físicamente porque pueden estar
referenciados por gestiones históricas.
*/
router.delete("/:id", allowRoles("Admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const estado = await db("estados")
      .where({ id })
      .first();

    if (!estado) {
      return res.status(404).json({
        error: "Estado no encontrado"
      });
    }

    await db("estados")
      .where({ id })
      .update({
        activo: false,
        updated_at: db.fn.now()
      });

    res.json({
      message: "Estado desactivado correctamente"
    });

  } catch (error) {
    console.error("Error desactivando estado:", error);

    res.status(500).json({
      error: "Error desactivando estado"
    });
  }
});

export default router;