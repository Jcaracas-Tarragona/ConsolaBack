import express from "express";
import mgmtDb from "../db/adminDb.js";

import {allowRoles} from "../middleware/roleMiddleware.js";
import { requireAuth } from "../middleware/auth.js";
import { logMenuChange } from "../services/menuLogs.service.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 15);
  const search = req.query.search || "";

  try {
    const baseQuery = mgmtDb("articulos");

    if (search) {
      baseQuery.whereILike("descripcion", `%${search}%`);
    }

    const [{ count }] = await baseQuery.clone().count("*");

    const items = await baseQuery
      .select("*")
      .limit(limit)
      .offset((page - 1) * limit)
      .orderBy("descripcion");

    res.json({
      items,
      total: Number(count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando artículos" });
  }
});

router.get("/:codigo", async (req, res) => {
  const art = await mgmtDb("articulos")
    .where({ codigo: req.params.codigo })
    .first();

  if (!art) return res.status(404).json({ error: "No existe" });
  res.json(art);
});

router.post("/", async (req, res) => {
  const data = req.body;

  await mgmtDb("articulos").insert(data);

  await logMenuChange({
    entidad: "articulo",
    entidadId: data.codigo,
    campo: "CREATED",
    valorNuevo: JSON.stringify(data),
    usuario: req.user.username,
    rol: req.user.role
  });

  res.status(201).json({ ok: true });
});

router.patch("/:codigo", async (req, res) => {
  const { codigo } = req.params;
  const cambios = req.body;

  const actual = await mgmtDb("articulos")
    .where({ codigo })
    .first();

  if (!actual) {
    return res.status(404).json({ error: "Artículo no existe" });
  }

  await mgmtDb("articulos")
    .where({ codigo })
    .update({
      ...cambios,
      updated_at: new Date()
    });

  for (const campo of Object.keys(cambios)) {
    await logMenuChange({
      entidad: "articulo",
      entidadId: codigo,
      campo,
      valorAnterior: actual[campo],
      valorNuevo: cambios[campo],
      usuario: req.user.username,
      rol: req.user.role
    });
  }

  res.json({ ok: true });
});

router.delete("/:codigo", async (req, res) => {
  await mgmtDb("articulos").where({ codigo: req.params.codigo }).del();

  await mgmtDb("logs_menu").insert({
    entidad: "articulo",
    entidad_id: req.params.codigo,
    campo: "DELETED",
    usuario: req.user.username,
    rol: req.user.role
  });

  res.json({ ok: true });
});

router.patch("/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  const user = req.user;

  if (typeof activo !== "boolean") {
    return res.status(400).json({ error: "activo debe ser boolean" });
  }

  await mgmtDb("articulos").where({ id }).update({ activo });

  await logMenuChange({
    entidad: "articulo",
    entidadId: id,
    campo: "UDTATE_ACTIVO",
    valorAnterior: activo ? false : true,
    valorNuevo: activo,
    usuario: user.username,
    rol: user.role,
  });

  res.json({ ok: true });
});

// routes/articulos.js
router.put("/:id", requireAuth, allowRoles("Admin", "Comercial"), async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    // 1️⃣ Obtener estado anterior
    const prev = await mgmtDb("articulos").where({ id }).first();
    if (!prev) return res.status(404).json({ error: "Artículo no existe" });

    // 2️⃣ Actualizar
    await mgmtDb("articulos").where({ id }).update(req.body);

    // 3️⃣ Comparar campos y logear SOLO los que cambian
    const camposLogeables = [ "descripcion", "precioA", "precioB", "precioC", "disponibleA",
      "disponibleB", "disponibleC", "activo", "fecha_inicio", "fecha_fin", ];

    for (const campo of camposLogeables) {
      if (prev[campo] !== req.body[campo]) {
        await logMenuChange({
          entidad: "articulo",
          entidadId: id,
          campo: "UPDATE" ,
          valorAnterior: prev[campo],
          valorNuevo: req.body[campo],
          usuario: user.username,
          rol: user.role,
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando artículo" });
  }
});



export default router;
