import mgmtDb from "../db/adminDb.js";
import {
  leerExcel,
  validarColumnas,
  obtenerDocumentosDuplicados
} from "./excelReader.js";
import {
  normalizarRegistro,
  normalizarTexto
} from "./normalizer.js";
import {
  obtenerVendedoresExistentes
} from "./sqlServerRepository.js";

const GRUPO_ESTADO = "VENDEDOR_IMPORT";

/**
 * OBTENER ID DE ESTADO
 */
async function obtenerEstadoId(codigo) {
  const estado = await mgmtDb("estados")
    .where({
      grupo: GRUPO_ESTADO,
      codigo,
      activo: true
    })
    .first("id");

  if (!estado) {
    throw new Error(
      `No existe el estado ${GRUPO_ESTADO}/${codigo}.`
    );
  }

  return estado.id;
}

/**
 * GENERAR PREVIEW
 */
export async function generarPreview(fileBuffer, usuarioId = null, empresa) {
  if (!empresa) {
    throw new Error(
      "Debe seleccionar una empresa."
    );
  }

  const codigoEmpresa = String(
    empresa
  ).trim().toUpperCase();

  const empresaConfig = await mgmtDb("empresas")
    .where({
      codigo: codigoEmpresa,
      activo: true
    })
    .first(
      "id",
      "codigo",
      "nombre"
    );

  if (!empresaConfig) {
    throw new Error(
      `La empresa ${codigoEmpresa} no existe o se encuentra inactiva.`
    );
  }

  if (
    String(empresaConfig.codigo)
      .trim()
      .toUpperCase() === "QA"
  ) {
    throw new Error(
      "QA no admite carga de vendedores."
    );
  }

  /*
   * LEER EXCEL
   */
  const rows = leerExcel(
    fileBuffer
  );

  validarColumnas(
    rows
  );

  const duplicados =
    obtenerDocumentosDuplicados(
      rows
    );

  if (duplicados.length) {
    throw new Error(
      `Existen documentos duplicados en el Excel: ${duplicados.join(", ")}`
    );
  }

  /*
   * OBTENER LOCALES DE LA EMPRESA
   */
  const conexiones = await mgmtDb(
    "connections"
  )
    .select(
      "codLocal",
      "name"
    )
    .where({
      empresa_id:
        empresaConfig.id
    });

  const mapaLocales =
    new Map();

  const mapaCodigoLocal =
    new Map();

  conexiones.forEach(local => {
    const nombreNormalizado =
      normalizarTexto(
        local.name
      );

    const codLocal =
      Number(
        local.codLocal
      );

    mapaLocales.set(
      nombreNormalizado,
      codLocal
    );

    mapaCodigoLocal.set(
      codLocal,
      local.name
    );
  });

  /*
   * NORMALIZAR EXCEL
   */
  const vendedoresExcel =
    rows.map(row =>
      normalizarRegistro(
        row,
        mapaLocales
      )
    );

  /*
   * OBTENER VENDEDORES SQL SERVER CENTRAL
   */
  const vendedoresBD =
    await obtenerVendedoresExistentes(
      vendedoresExcel.map(
        vendedor =>
          vendedor.cuil
      ),
      empresaConfig.codigo
    );

  /*
   * GENERAR PREVIEW
   */
  const preview = [];

  const summary = {
    procesados:
      vendedoresExcel.length,
    creados: 0,
    actualizados: 0,
    desactivados: 0,
    sinCambios: 0,
    errores: 0
  };

  for (
    const vendedorExcel
    of vendedoresExcel
  ) {
    /*
     * LOCAL NO EXISTE
     */
    if (vendedorExcel.error) {
      summary.errores++;

      preview.push({
        ...vendedorExcel,
        localNombre: "-",
        accion: "ERROR",
        cambios: [
          "LOCAL"
        ],
        mensaje:
          vendedorExcel.error
      });

      continue;
    }

    const cuil =
      String(
        vendedorExcel.cuil || ""
      )
        .trim()
        .toUpperCase();

    const vendedorBD =
      vendedoresBD.get(
        cuil
      ) ?? null;

    const partesLocal =
      String(
        vendedorExcel.local || ""
      ).split(",");

    const codLocal =
      Number(
        partesLocal[1]
      );

    const localNombre =
      mapaCodigoLocal.get(
        codLocal
      ) || "-";

    /*
     * NO EXISTE EN SQL SERVER
     */
    if (!vendedorBD) {
      if (
        vendedorExcel.estado ===
        "ACTIVO"
      ) {
        summary.creados++;

        preview.push({
          ...vendedorExcel,
          cuil,
          localNombre,
          accion: "CREATE",
          cambios: []
        });
      } else {
        summary.sinCambios++;

        preview.push({
          ...vendedorExcel,
          cuil,
          localNombre,
          accion:
            "SIN_CAMBIOS",
          cambios: []
        });
      }

      continue;
    }

    /*
     * EXISTE EN SQL SERVER
     */
    const cambios = [];

    const activoBD =
      vendedorBD.debaja === 0 &&
      vendedorBD.inhab === 0;

    /*
     * ACTIVO EN BD
     * E INACTIVO EN EXCEL
     */
    if (
      activoBD &&
      vendedorExcel.estado ===
        "INACTIVO"
    ) {
      summary.desactivados++;

      preview.push({
        ...vendedorExcel,
        cuil,
        localNombre,
        accion:
          "DEACTIVATE",
        cambios: []
      });

      continue;
    }

    /*
     * YA ESTÁ INACTIVO
     */
    if (
      !activoBD &&
      vendedorExcel.estado ===
        "INACTIVO"
    ) {
      summary.sinCambios++;

      preview.push({
        ...vendedorExcel,
        cuil,
        localNombre,
        accion:
          "SIN_CAMBIOS",
        cambios: []
      });

      continue;
    }

    /*
     * REACTIVACIÓN
     */
    if (
      !activoBD &&
      vendedorExcel.estado ===
        "ACTIVO"
    ) {
      cambios.push(
        "ESTADO"
      );
    }

    /*
     * CAMBIO DE LOCAL
     */
    if (
      String(
        vendedorBD.locales || ""
      ).trim() !==
      String(
        vendedorExcel.local || ""
      ).trim()
    ) {
      cambios.push(
        "LOCAL"
      );
    }

    /*
     * CAMBIO DE PERFIL
     */
    if (
      String(
        vendedorBD.puesto || ""
      ).trim().toUpperCase() !==
      String(
        vendedorExcel.perfil || ""
      ).trim().toUpperCase()
    ) {
      cambios.push(
        "PERFIL"
      );
    }

    if (cambios.length) {
      summary.actualizados++;

      preview.push({
        ...vendedorExcel,
        cuil,
        localNombre,
        accion: "UPDATE",
        cambios
      });
    } else {
      summary.sinCambios++;

      preview.push({
        ...vendedorExcel,
        cuil,
        localNombre,
        accion:
          "SIN_CAMBIOS",
        cambios: []
      });
    }
  }

  /*
   * OBTENER ESTADO PREVIEW
   */
  const estadoId =
    await obtenerEstadoId(
      "PREVIEW"
    );

  /*
   * GUARDAR PREVIEW
   *
   * IMPORTANTE:
   * central_actualizado_at queda NULL.
   *
   * Esto significa que el archivo fue analizado,
   * pero todavía NO ha sido confirmado/aplicado
   * sobre SQL Server Central.
   */
  const [registroCreado] =
    await mgmtDb(
      "vendedor_import_preview"
    )
      .insert({
        usuario_id:
          usuarioId,
        empresa:
          empresaConfig.codigo,
        estado_id:
          estadoId,
        summary:
          JSON.stringify(
            summary
          ),
        preview:
          JSON.stringify(
            preview
          ),
        central_actualizado_at:
          null
      })
      .returning("id");

  const previewId =
    typeof registroCreado ===
    "object"
      ? registroCreado.id
      : registroCreado;

  return {
    previewId,
    empresa:
      empresaConfig.codigo,
    estado: "PREVIEW",
    summary,
    preview
  };
}