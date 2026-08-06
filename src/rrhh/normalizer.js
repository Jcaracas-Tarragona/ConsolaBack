export function normalizarTexto(texto = "") {

  return texto
    .trim()
    .replace(/[áÁ]/g, "a")
    .replace(/[éÉ]/g, "e")
    .replace(/[íÍ]/g, "i")
    .replace(/[óÓ]/g, "o")
    .replace(/[úÚ]/g, "u")
    .replace(/\s+/g, " ")
    .toUpperCase();

}

/** NORMALIZAR NOMBRE APELLIDO APELLIDO NOMBRE */
export function normalizarNombre({
  nombre,
  apellido,
  segundoApellido
}) {

  return [
    apellido,
    segundoApellido,
    nombre
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

}

/** NORMALIZAR CARGO */
export function normalizarCargo(cargo = "") {

  cargo = cargo.toUpperCase();

  if (
    cargo.includes("JEFE") ||
    cargo.includes("ASISTENTE")
  ) {
    return "GERENTE";
  }

  if (cargo.includes("TEAM")) {
    return "CAJERO";
  }

  return "CAJERO";

}

/** NORMALIZAR ESTADO */
export function normalizarEstado(estado = "") {

  estado = estado.trim().toUpperCase();

  return estado === "ACTIVO"
    ? "ACTIVO"
    : "INACTIVO";

}

/** NORMALIZAR DOCUMENTO */
export function normalizarDocumento(documento) {

  if (!documento)
    return "";

  return documento
    .toString()
    .trim()
    .toUpperCase();

}

/** NORMALIZAR LOCAL */
export function normalizarLocal(nombreLocal, mapaLocales) {

  const key = normalizarTexto(nombreLocal);

  if (!mapaLocales.has(key))
    return null;

  return `0,${mapaLocales.get(key)}`;
}

/** NORMALIZAR REGISTRO COMPLETO */
export function normalizarRegistro(fila, mapaLocales) {

  const local = normalizarLocal(
    fila["Trabajo - Nombre Área"],
    mapaLocales
  );

  return {

    cuil: normalizarDocumento(
      fila["Empleado  Número de Documento"]
    ),

    nombre: normalizarNombre({
      nombre: fila["Empleado - Nombre"],
      apellido: fila["Empleado - Apellido"],
      segundoApellido: fila["Empleado - Segundo Apellido"]
    }),

    perfil: normalizarCargo(
      fila["Trabajo - Cargo"]
    ),

    estado: normalizarEstado(
      fila["Empleado - Estado"]
    ),

    local,

    error: !local
      ? `El local "${fila["Trabajo - Nombre Área"]}" no existe.`
      : null

  };

}