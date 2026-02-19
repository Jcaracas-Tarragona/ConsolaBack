import mgmtDb from "../db/adminDb.js";

export async function logMenuChange({
  entidad,
  entidadId,
  campo,
  valorAnterior,
  valorNuevo,
  usuario,
  rol
}) {
  try {
    await mgmtDb("menu_logs").insert({
      entidad,
      entidad_id: entidadId,
      campo,
      valor_anterior: valorAnterior?.toString() ?? null,
      valor_nuevo: valorNuevo?.toString() ?? null,
      usuario,
      rol,
      created_at: new Date()
    });
  } catch (err) {
    console.error("❌ Error guardando menu log", err);
  }
}