import express from "express";
import multer from "multer";
import { generarPreview } from "../rrhh/preview.js";
import { ejecutarImportacion } from "../rrhh/importer.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage()
});

/*  GENERAR PREVIEW  */

router.post( "/preview", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Debe seleccionar un archivo."
        });
      }

      const empresa = req.body.empresa || "QA";
      const resultado = await generarPreview(
        req.file.buffer,
        req.user.id,
        empresa);
        
        
      res.json(resultado);

    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: error.message
      });
    }
  }

);

/* EJECUTAR IMPORTACIÓN */

router.post("/importar/:previewId",async (req, res) => {
    try {
      const resultado = await ejecutarImportacion(req.params.previewId);
      res.json(resultado);

    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: error.message
      });
    }
  }
);

export default router;