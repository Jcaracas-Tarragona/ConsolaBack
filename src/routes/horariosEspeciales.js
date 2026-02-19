import express from "express";
import mgmtDb from "../db/adminDb.js";
import { requireAuth } from "../middleware/auth.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/",allowRoles("Admin", "Comercial"), async (req, res) => {
    try {
      const rows = await mgmtDb("local_horarios_especiales as he")
        .join("connections as c", "c.codLocal", "he.codlocal")
        .select("he.id","he.codlocal","c.name","he.fecha", "he.hora_apertura",
          "he.hora_cierre", "he.cerrado","he.motivo","he.activo")
        .where("he.activo", 1)
        .orderBy(["c.name", "he.fecha"]);

      // Agrupar por local
      const grouped = {};

      rows.forEach(r => {
        if (!grouped[r.codlocal]) {
          grouped[r.codlocal] = {
            codlocal: r.codlocal,
            local_nombre: r.local_nombre,
            especiales: []
          };
        }

        grouped[r.codlocal].especiales.push({
          id: r.id,
          fecha: r.fecha,
          hora_apertura: r.hora_apertura,
          hora_cierre: r.hora_cierre,
          cerrado: r.cerrado,
          motivo: r.motivo
        });
      });

      res.json(Object.values(grouped));

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error obteniendo horarios especiales" });
    }
  }
);

router.get("/he/:codlocal",allowRoles("Admin", "Comercial"), async (req, res) => {
    const { codlocal } = req.params;
    try {
      const rows = await mgmtDb("local_horarios_especiales as he")
        .select("he.id","he.codlocal","he.fecha", "he.hora_apertura",
          "he.hora_cierre", "he.cerrado","he.motivo","he.activo")
        .where("he.codlocal", codlocal)
        .orderBy([ "he.fecha"]);

      // Agrupar por local
      const grouped = {};

      rows.forEach(r => {
        if (!grouped[r.codlocal]) {
          grouped[r.codlocal] = {
            codlocal: r.codlocal,
            local_nombre: r.name,
            especiales: []
          };
        }

        grouped[r.codlocal].especiales.push({
          id: r.id,
          fecha: r.fecha,
          hora_apertura: r.hora_apertura,
          hora_cierre: r.hora_cierre,
          cerrado: r.cerrado,
          motivo: r.motivo
        });
      });

      res.json(Object.values(grouped));
      
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error obteniendo horarios especiales" });
    }
  }
);

router.post("/",allowRoles("Admin", "Comercial"),async (req, res) => {

    const {codlocal,fecha,hora_apertura,hora_cierre,cerrado,motivo} = req.body;

    if (!codlocal || !fecha) {
      return res.status(400).json({ message: "Local y fecha son obligatorios" });
    }

    try {
      await mgmtDb.transaction(async trx => {
        try{
            await trx("local_horarios_especiales").where({ codlocal, fecha }).del();

        } catch (err) {
            console.error("Error eliminando horario especial previo", err);
        }      


        await trx("local_horarios_especiales").insert({
          codlocal,
          fecha,
          hora_apertura: cerrado ? null : hora_apertura,
          hora_cierre: cerrado ? null : hora_cierre,
          cerrado,
          motivo,
          activo: 1
        });
      });

      res.json({ message: "Horario especial guardado" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error guardando horario especial" });
    }
  }
);

router.delete("/:id",allowRoles("Admin"),async (req, res) => {
    try {
      await mgmtDb("local_horarios_especiales").where({ id: req.params.id }).update({ activo: 0 });

      res.json({ message: "Horario especial eliminado" });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error eliminando horario especial" });
    }
  }
);


export default router;