import express from "express";
import mgmtDb from "../db/adminDb.js";

const router = express.Router();

router.get( "/", async (req, res) => {
    try {
      const empresas = await mgmtDb("empresas")
        .select("id", "codigo", "nombre")
        .where({ activo: true })
        .orderBy("id");

      res.json(empresas);

    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Error obteniendo empresas."
      });

    }

  }
);

export default router;