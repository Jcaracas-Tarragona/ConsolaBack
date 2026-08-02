import mgmtDb from "../db/adminDb.js";
import { leerExcel, validarColumnas, obtenerDocumentosDuplicados } from "./excelReader.js";
import { normalizarRegistro } from "./normalizer.js";
import { obtenerVendedoresExistentes } from "./sqlServerRepository.js";

/** GENERAR PREVIEW */
export async function generarPreview(fileBuffer, usuarioId = null, empresa = "QA") {
  
  /*  LEER EXCEL */
  const rows = leerExcel(fileBuffer);
  validarColumnas(rows);
  const duplicados = obtenerDocumentosDuplicados(rows);

  if (duplicados.length) {
    throw new Error(
      `Existen documentos duplicados en el Excel: ${duplicados.join(", ")}`
    );
  }

  /* OBTENER LOCALES */

  const conexiones = await mgmtDb("connections")
    .select("codLocal", "name");

  const mapaLocales = new Map();
  const mapaCodigoLocal = new Map();


  conexiones.forEach(local => {
    mapaLocales.set(
      local.name.trim().toUpperCase(),
      local.codLocal
    );
    mapaCodigoLocal.set(
      local.codLocal,
      local.name
    );

  });

  /* NORMALIZAR EXCEL  */

  const vendedoresExcel = rows.map(row =>
    normalizarRegistro(row, mapaLocales)
  );

  /* OBTENER VENDEDORES SQL SERVER
     (IMPLEMENTAREMOS EN EL SIGUIENTE ARCHIVO) */

  const vendedoresBD = await obtenerVendedoresExistentes(
    vendedoresExcel.map(v => v.cuil),empresa
    );

  /*
      Aquí posteriormente llamaremos algo como:

      const vendedoresBD =
          await obtenerVendedoresExistentes(
              vendedoresExcel.map(v => v.cuil)
          );

  */

  /*GENERAR PREVIEW */

  const preview = [];

  const summary = {
    procesados: vendedoresExcel.length,
    creados: 0,
    actualizados: 0,
    desactivados: 0,
    sinCambios: 0,
    errores: 0
    };

    for (const vendedorExcel of vendedoresExcel) {
        const vendedorBD =
            vendedoresBD.get(vendedorExcel.cuil) ?? null;

        /*
        * NO EXISTE EN SQL
        */

        if (!vendedorBD) {
            if (vendedorExcel.estado === "ACTIVO") {
                summary.creados++;
                preview.push({
                    ...vendedorExcel,
                    accion: "CREATE",
                    cambios: []
                });
            } else {
                summary.sinCambios++;
                preview.push({
                    ...vendedorExcel,
                    accion: "SIN_CAMBIOS",
                    cambios: []
                });
            }
            continue;
        }

        /* EXISTE EN SQL */
        const cambios = [];
        const activoBD = vendedorBD.debaja === 0;
        if (activoBD && vendedorExcel.estado === "INACTIVO") {
            summary.desactivados++;
            preview.push({
            ...vendedorExcel,
            localNombre: mapaCodigoLocal.get(
                Number(vendedorExcel.local.split(",")[1])
            ),
            accion: "DEACTIVATE",
            cambios: []
            });
            continue;
        }

        if (!activoBD && vendedorExcel.estado === "INACTIVO") {
          summary.sinCambios++;
          preview.push({
              ...vendedorExcel,
              localNombre: mapaCodigoLocal.get(
                  Number(vendedorExcel.local.split(",")[1])
              ),
              accion: "SIN_CAMBIOS",
              cambios: []
          });
          continue;
      }

        if (!activoBD && vendedorExcel.estado === "ACTIVO") {
            cambios.push("ESTADO");
        }

        if (vendedorBD.locales !== vendedorExcel.local) {
            cambios.push("LOCAL");
        }

        if (vendedorBD.puesto !== vendedorExcel.perfil) {
            cambios.push("PERFIL");
        }

        if (cambios.length) {
            summary.actualizados++;
            preview.push({
            ...vendedorExcel,
            localNombre: mapaCodigoLocal.get(
                Number(vendedorExcel.local.split(",")[1])
            ),
            accion: "UPDATE",
            cambios
            });
        } else {
            summary.sinCambios++;
            preview.push({
            ...vendedorExcel,
            localNombre: mapaCodigoLocal.get(
                Number(vendedorExcel.local.split(",")[1])
            ),
            accion: "SIN_CAMBIOS",
            cambios: []
            });
        }
    }
    
  /* GUARDAR PREVIEW */
  const [previewId] = await mgmtDb("vendedor_import_preview")
  .insert({
    usuario_id: null,
    empresa,
    summary: JSON.stringify(summary),
    preview: JSON.stringify(preview)
  })
  .returning("id");

  return {
    previewId:
      typeof previewId === "object"
        ? previewId.id
        : previewId,

    summary,
    preview
  };

}