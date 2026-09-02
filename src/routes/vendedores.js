import express from "express";
import multer from "multer";
import { generarPreview } from "../rrhh/preview.js";
import { ejecutarImportacion } from "../rrhh/importer.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

/* =====================================================
   GENERAR PREVIEW
===================================================== */

router.post(
  "/preview",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Debe seleccionar un archivo."
        });
      }

      const empresa = String(
        req.body.empresa || ""
      )
        .trim()
        .toUpperCase();

      if (!empresa) {
        return res.status(400).json({
          message: "Debe seleccionar una empresa."
        });
      }

      const resultado = await generarPreview(
        req.file.buffer,
        req.user?.id ?? null,
        empresa
      );

      return res.json(resultado);
    } catch (error) {
      console.error(
        "Error generando preview de vendedores:",
        error
      );

      return res.status(400).json({
        message:
          error.message ||
          "Error generando el preview."
      });
    }
  }
);

/* =====================================================
   EJECUTAR IMPORTACIÓN CENTRAL
===================================================== */

router.post(
  "/importar/:previewId",
  async (req, res) => {
    try {
      const previewId = Number(
        req.params.previewId
      );

      if (
        !Number.isInteger(previewId) ||
        previewId <= 0
      ) {
        return res.status(400).json({
          message:
            "El identificador del preview no es válido."
        });
      }

      const resultado =
        await ejecutarImportacion(
          previewId
        );

      return res.json(resultado);
    } catch (error) {
      console.error(
        "Error importando vendedores a Central:",
        error
      );

      return res.status(
        error.statusCode || 500
      ).json({
        message:
          error.message ||
          "Error realizando la importación."
      });
    }
  }
);

export default router;