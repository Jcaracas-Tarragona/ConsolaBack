import express from "express";
import mgmtDb from "../db/adminDb.js";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import ExcelJS from "exceljs";

const router = express.Router();

router.use(requireAuth);

/**
 * GET /horarios-base
 * Agrupa días con mismo horario por local
 */
router.get("/",allowRoles("Admin", "Comercial", "Zonal"),async (req, res) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const offset = (page - 1) * limit;

      /* ===============================
         QUERY BASE
      =============================== */
      let query = `
        SELECT
          h.codlocal,
          c.name AS local_nombre,
          h.dia_semana,
          h.hora_apertura,
          h.hora_cierre,
          h.activo,
          h.cerrado
        FROM local_horarios_base h
        JOIN connections c ON c."codLocal" = h.codlocal
      `;

      const params = [];

      if (search) {
        query += ` WHERE LOWER(c.name) LIKE LOWER(?) `;
        params.push(`%${search}%`);
      }

      query += `
        ORDER BY c.name, h.hora_apertura, h.dia_semana
      `;

      const result = await mgmtDb.raw(query, params);
      const rows = result.rows;
      

      /* ===============================
         MAPA DÍAS
      =============================== */
      const diasMap = {
        1: "Lun",
        2: "Mar",
        3: "Mié",
        4: "Jue",
        5: "Vie",
        6: "Sáb",
        7: "Dom",
      };

      /* ===============================
         AGRUPACIÓN FINAL
         ➜ 1 REGISTRO POR LOCAL
      =============================== */
      const agrupado = {};

      rows.forEach((r) => {
        if (!agrupado[r.codlocal]) {
          agrupado[r.codlocal] = {
            codlocal: r.codlocal,
            local_nombre: r.local_nombre,
            bloques: {},
          };
        }

        const keyBloque = `${r.hora_apertura}-${r.hora_cierre}-${r.activo}`;

        if (!agrupado[r.codlocal].bloques[keyBloque]) {
          agrupado[r.codlocal].bloques[keyBloque] = {
            dias: [],
            hora_apertura: r.cerrado ? null : r.hora_apertura.slice(0, 5),
            hora_cierre: r.cerrado ? null : r.hora_cierre.slice(0, 5),
            activo: r.activo,
            cerrado: r.cerrado
          };
        }

        agrupado[r.codlocal].bloques[keyBloque].dias.push(
          diasMap[r.dia_semana]
        );
      });

      /* ===============================
         FORMATO RESPUESTA
      =============================== */
      const items = Object.values(agrupado).map((local) => ({
        codlocal: local.codlocal,
        local_nombre: local.local_nombre,
        horarios: Object.values(local.bloques).map((b) => ({
          dias: b.dias.join(" - "),
          horario: `${b.hora_apertura} - ${b.hora_cierre}`,
          activo: b.activo,
          cerrado: b.cerrado
        })),
      }));

      const paginatedItems = items.slice(offset, offset + Number(limit));

      res.json({
        items: paginatedItems,
        total: items.length,
      });

    } catch (err) {
      console.error("❌ Error horarios base:", err);
      res.status(500).json({ error: "Error obteniendo horarios base" });
    }
  }
);


/**
 * POST → Crear o actualizar horario base
 */
router.post("/", allowRoles("Admin", "Comercial", "Zonal"), async (req, res) => {
  const { codlocal, dia_semana, hora_apertura, hora_cierre, activo, cerrado } = req.body;

  if (codlocal == null || dia_semana == null || !hora_apertura ||!hora_cierre) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    await mgmtDb.raw(
      `
      INSERT INTO local_horarios_base
        (codlocal, dia_semana, hora_apertura, hora_cierre, activo , cerrado)
      VALUES (?, ?, ?, ?, COALESCE(?, true), COALESCE(?, false))
      ON CONFLICT (codlocal, dia_semana)
      DO UPDATE SET
        hora_apertura = EXCLUDED.hora_apertura,
        hora_cierre   = EXCLUDED.hora_cierre,
        activo        = EXCLUDED.activo,
        cerrado      = EXCLUDED.cerrado,
        created_at    = now()
      `,
      [codlocal, dia_semana, hora_apertura, hora_cierre, activo, cerrado]
    );

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando horario base" });
  }
});


router.post("/bulk", allowRoles("Admin"), async (req, res) => {
  try {
    let {
      dias,
      locales,
      hora_apertura,
      hora_cierre,
      activo = true,
      cerrado = false
    } = req.body;

    // NORMALIZACIÓN 🔥
    if (cerrado) {
      hora_apertura = null;
      hora_cierre = null;
    } else {
      if (!hora_apertura || !hora_cierre || hora_apertura >= hora_cierre) {
        return res.status(400).json({ error: "Horario inválido" });
      }
    }

    if (!Array.isArray(dias) || dias.length === 0) {
      return res.status(400).json({ error: "Debe seleccionar al menos un día" });
    }

    if (!Array.isArray(locales) || locales.length === 0) {
      return res.status(400).json({ error: "Debe seleccionar al menos un local" });
    }

    const rows = [];

    for (const codlocal of locales) {
      for (const dia_semana of dias) {
        rows.push({
          codlocal,
          dia_semana,
          hora_apertura,
          hora_cierre,
          activo,
          cerrado
        });
      }
    }
    
    await mgmtDb("local_horarios_base")
      .insert(rows)
      .onConflict(["codlocal", "dia_semana"])
      .merge({
        hora_apertura,
        hora_cierre,
        activo,
        cerrado
      });

    res.json({ ok: true, inserted: rows.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error guardando horarios base" });
  }
});


/**
 * PATCH → Activar / desactivar
 */
router.patch("/:id/estado", allowRoles("Admin"), async (req, res) => {
  const { activo } = req.body;

  try {
    await mgmtDb("local_horarios_base")
      .where({ id: req.params.id })
      .update({ activo });

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cambiando estado" });
  }
});

/**
 * DELETE
 */
router.delete("/:id", allowRoles("Admin"), async (req, res) => {
  try {
    await mgmtDb("local_horarios_base")
      .where({ id: req.params.id })
      .del();

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error eliminando horario" });
  }
});

router.post("/replace/:codlocal", allowRoles("Admin", "Comercial","Zonal"), async (req, res) => {
    const { codlocal } = req.params;
    const { dias, 
      hora_apertura, 
      hora_cierre, 
      activo, cerrado } = req.body;

    if (cerrado === false) {
      if (!hora_apertura || !hora_cierre || hora_apertura >= hora_cierre) {
        return res.status(400).json({ message: "Horario inválido" });
      }
    }else { 
      hora_apertura = null;
      hora_cierre = null;
    }

    if (!Array.isArray(dias) || dias.length === 0) {
      return res.status(400).json({ message: "Días son obligatorios" });
    }

    try {
      await mgmtDb.transaction(async trx => {

        // 1️⃣ Eliminar horarios base SOLO del local
        await trx("local_horarios_base")
          .where({ codlocal })
          .del();

        // 2️⃣ Insertar nuevos horarios base
        const rows = dias.map(dia => ({
          codlocal,
          dia_semana: dia,
          hora_apertura,
          hora_cierre,
          activo,
          cerrado
        }));

        await trx("local_horarios_base").insert(rows);
      });

      res.json({ message: "Horario base reemplazado correctamente" });

    } catch (err) {
      console.error("REPLACE HORARIO BASE ERROR:", err);
      res.status(500).json({ message: "Error reemplazando horarios base" });
    }
  }
);


router.get("/export/excel",allowRoles("Admin", "Comercial","Zonal"),
  async (req, res) => {
    try {
      const horarios = await mgmtDb("vw_horarios_unificados")
        .orderBy(["codlocal", "menuOrigen", "tipo_horario", "fecha"]);

      const wb = new ExcelJS.Workbook();

      /* =========================
         HOJA: HORARIOS BASE
         ========================= */
      const wsBase = wb.addWorksheet("Horarios Base");

      wsBase.columns = [
        { header: "Código Local", key: "codlocal", width: 15 },
        { header: "Nombre Local", key: "nombre_local", width: 30 },
        { header: "Menú Origen", key: "menuOrigen", width: 20 },
        { header: "Menú Crítico", key: "menuCritico", width: 15 },
        { header: "Días", key: "dias", width: 25 },
        { header: "Horario", key: "horario", width: 20 },
        { header: "Estado", key: "estado", width: 15 },
        { header: "Tipo Horario", key: "tipo_horario", width: 15 }
      ];

      horarios
        .filter(h => h.tipo_horario === "BASE")
        .forEach(h => {
          wsBase.addRow({
            codlocal: h.codlocal,
            nombre_local: h.nombre_local,
            menuOrigen: h.menuOrigen,
            menuCritico: h.menuCritico,
            dias: h.dias,
            horario: h.cerrado
              ? "CERRADO"
              : `${h.hora_apertura.slice(0, 5)} - ${h.hora_cierre.slice(0, 5)}`,
            estado: h.activo ? "Activo" : "Inactivo",
            tipo_horario: h.tipo_horario
          });
        });

      /* =========================
         HOJA: HORARIOS ESPECIALES
         ========================= */
      const wsEsp = wb.addWorksheet("Horarios Especiales");

      wsEsp.columns = [
        { header: "Código Local", key: "codlocal", width: 15 },
        { header: "Nombre Local", key: "nombre_local", width: 30 },
        { header: "Menú Origen", key: "menuOrigen", width: 20 },
        { header: "Menú Crítico", key: "menuCritico", width: 15 },
        { header: "Fecha", key: "fecha", width: 15 },
        { header: "Horario", key: "horario", width: 20 },
        { header: "Estado", key: "estado", width: 15 },
        { header: "Tipo Horario", key: "tipo_horario", width: 15 }
      ];

      horarios
        .filter(h => h.tipo_horario === "ESPECIAL")
        .forEach(h => {
          wsEsp.addRow({
            codlocal: h.codlocal,
            nombre_local: h.nombre_local,
            menuOrigen: h.menuOrigen,
            menuCritico: h.menuCritico,
            fecha: h.fecha
              ? h.fecha.toISOString().split("T")[0]
              : "",
            horario: h.cerrado
              ? "CERRADO"
              : `${h.hora_apertura.slice(0, 5)} - ${h.hora_cierre.slice(0, 5)}`,
            estado: h.activo ? "Activo" : "Inactivo",
            tipo_horario: h.tipo_horario
          });
        });

      /* =========================
         RESPONSE
         ========================= */
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=horarios.xlsx"
      );

      await wb.xlsx.write(res);
      res.end();

    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error exportando Excel" });
    }
  }
);


export default router;
