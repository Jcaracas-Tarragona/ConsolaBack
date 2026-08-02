import xlsx from "xlsx";
const MAX_FILAS = 300;
/** Lee un archivo Excel y retorna todas las filas
 * como objetos utilizando la primera hoja. */

export function leerExcel(fileBuffer) {
  const workbook = xlsx.read(fileBuffer, {
    type: "buffer" });

  const sheetName = workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false
  });

  return rows;

}

/**  Verifica que el Excel contenga las columnas obligatorias. */
export function validarColumnas(rows) {

  if (!rows.length) {
    throw new Error("El archivo no contiene registros.");
  }

  if (rows.length > MAX_FILAS) {

    throw new Error(
      `El archivo contiene ${rows.length} registros. El máximo permitido es ${MAX_FILAS}.`
    );

  }

  const columnas = Object.keys(rows[0]);

  const requeridas = [

    "Empleado  Número de Documento",

    "Empleado - Nombre",

    "Empleado - Apellido",

    "Empleado - Segundo Apellido",

    "Trabajo - Nombre Área",

    "Trabajo - Cargo",

    "Empleado - Estado"

  ];

  const faltantes = requeridas.filter(
    c => !columnas.includes(c)
  );

  if (faltantes.length) {

    throw new Error(
      `El archivo no contiene las columnas requeridas: ${faltantes.join(", ")}`
    );

  }

  return true;

}

/** Detecta documentos duplicados dentro del Excel. */
export function obtenerDocumentosDuplicados(rows) {
  const contador = new Map();
  for (const row of rows) {
    const documento = row["Empleado  Número de Documento"]
      ?.toString()
      .trim();

    if (!documento)
      continue;

    contador.set(
      documento,
      (contador.get(documento) || 0) + 1
    );
  }

  return [...contador.entries()]
    .filter(([_, cantidad]) => cantidad > 1)
    .map(([documento]) => documento);

}