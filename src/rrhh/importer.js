import mgmtDb from "../db/adminDb.js";

import { insertarVendedores, actualizarVendedores, desactivarVendedores } from "./sqlServerRepository.js";

/** EJECUTAR IMPORTACIÓN */
export async function ejecutarImportacion(previewId) {

  /*  OBTENER PREVIEW */
  const preview = await mgmtDb("vendedor_import_preview")
    .where({ id: previewId })
    .first();

  if (!preview) {
    throw new Error("No existe el preview.");
  }

  const registros = preview.preview;
  /* AGRUPAR ACCIONES */

  const crear =
    registros.filter(x => x.accion === "CREATE");

  const actualizar =
    registros.filter(x => x.accion === "UPDATE");

  const desactivar =
    registros.filter(x => x.accion === "DEACTIVATE");

  /* CREATE */

  if (crear.length) {

    await insertarVendedores(crear,preview.empresa);

  }

  /* UPDATE */
  if (actualizar.length) {
    await actualizarVendedores(actualizar,preview.empresa);
  }



  /* DEACTIVATE */
  if (desactivar.length) {
    await desactivarVendedores(desactivar,preview.empresa);
  }

  /* ELIMINAR PREVIEW */
  await mgmtDb("vendedor_import_preview")
    .where({ id: previewId })
    .del();

  return {
    ok: true,
    creados: crear.length,
    actualizados: actualizar.length,
    desactivados: desactivar.length
  };

}