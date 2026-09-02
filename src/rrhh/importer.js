import mgmtDb from "../db/adminDb.js";
import {
  insertarVendedores,
  actualizarVendedores,
  desactivarVendedores
} from "./sqlServerRepository.js";

export async function ejecutarImportacion(previewId) {
  const preview = await mgmtDb("vendedor_import_preview")
    .where({ id: previewId })
    .first();

  if (!preview) {
    throw new Error("No existe el preview.");
  }

  if (!preview.empresa) {
    throw new Error(
      "El preview no tiene una empresa asociada."
    );
  }

  if (preview.central_actualizado_at) {
    throw new Error(
      "Este preview ya fue procesado anteriormente."
    );
  }

  const registros =
    typeof preview.preview === "string"
      ? JSON.parse(preview.preview)
      : preview.preview;

  if (!Array.isArray(registros)) {
    throw new Error(
      "El contenido del preview no es válido."
    );
  }

  const errores = registros.filter(
    x => x.accion === "ERROR"
  );

  if (errores.length) {
    throw new Error(
      "El preview contiene registros con errores y no puede ser importado."
    );
  }

  const crear = registros.filter(
    x => x.accion === "CREATE"
  );

  const actualizar = registros.filter(
    x => x.accion === "UPDATE"
  );

  const desactivar = registros.filter(
    x => x.accion === "DEACTIVATE"
  );

  let errorCentral = null;

  try {
    if (crear.length) {
      await insertarVendedores(
        crear,
        preview.empresa
      );
    }

    if (actualizar.length) {
      await actualizarVendedores(
        actualizar,
        preview.empresa
      );
    }

    if (desactivar.length) {
      await desactivarVendedores(
        desactivar,
        preview.empresa
      );
    }
  } catch (error) {
    console.error(
      `Error importando preview ${previewId} a ${preview.empresa}:`,
      error
    );

    errorCentral = error;
  }

  await mgmtDb("vendedor_import_preview")
    .where({ id: previewId })
    .update({
      central_actualizado_at:
        mgmtDb.fn.now()
    });

  if (errorCentral) {
    return {
      ok: false,
      alerta: true,
      cargaParcial: true,
      previewId: Number(previewId),
      empresa: preview.empresa,
      message:
        "La carga se interrumpió y algunos registros pudieron haberse aplicado en Central. Revise los datos y realice una nueva carga para corregir cualquier diferencia.",
      error:
        errorCentral.message
    };
  }

  return {
    ok: true,
    alerta: false,
    cargaParcial: false,
    previewId: Number(previewId),
    empresa: preview.empresa,
    creados: crear.length,
    actualizados: actualizar.length,
    desactivados: desactivar.length,
    message:
      "Los vendedores fueron actualizados correctamente en Central."
  };
}