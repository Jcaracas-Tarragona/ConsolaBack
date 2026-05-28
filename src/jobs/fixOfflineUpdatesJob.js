import cron from "node-cron";
import mgmtDb from "../db/adminDb.js";
import sql from "mssql";
import { getConnectionById, makeMssqlConfig } from "../db/connections.js";

async function runFixOfflineUpdates() {

/*/ 🔥 PASO 0: APAGADO MASIVO PARA LOCALES KIOSKO
console.log("⛔ Apagando artículos en locales KIOSKO");

const conexionesKiosko = await mgmtDb("connections")
  .where("kiosko", true)
  .select("*");

if (!conexionesKiosko.length) {
  console.log("ℹ️ No hay conexiones con kiosko activo");
} else {
  console.log(`🏪 ${conexionesKiosko.length} locales con kiosko activo`);
}

for (const connRow of conexionesKiosko) {
  try {
    const config = makeMssqlConfig(connRow.host);
    const pool = await sql.connect(config);

    await pool.request().query(`
      UPDATE articulo
      SET Web = 0
      WHERE codigo IN (2173)
    `);

    await pool.close();

    console.log(`✅ Artículos apagados en local ${connRow.codLocal}`);

  } catch (err) {
    console.log(
      `❌ No se pudo apagar artículos en local ${connRow.codLocal}`,
      err.message
    );
  }
}/*/


  console.log("🛠️ Iniciando tarea automática de reparación de Web...");

  try {
    // 1️⃣ Obtener todos los registros pendientes sin corregir
    const pendientes = await mgmtDb("logs")
      .where("requiereCorreccion", true)
      .andWhere("corregido", false)
      .select("*");

    const desactivar = await mgmtDb("local_horarios_especiales")
      .where("activo", true)
      .andWhere("fecha", "<", mgmtDb.fn.now())
      .update({ activo: false });

    if (desactivar) {
      console.log(`🔕 Desactivados ${desactivar} horarios especiales caducados`);
    }

    if (!pendientes.length) {
      console.log("✅ No hay artículos pendientes de corrección");
      return;
    }

    console.log(`📦 ${pendientes.length} artículos pendientes de corrección`);

    // 2️⃣ Agrupar por codLocal
    const porLocal = pendientes.reduce((map, log) => {
      if (!map[log.codLocal]) map[log.codLocal] = [];
      map[log.codLocal].push(log);
      return map;
    }, {});

    // 3️⃣ Procesar cada local
    for (const codLocal of Object.keys(porLocal)) {
      console.log(`🏬 Procesando local ${codLocal}`);
      const LocalID = await mgmtDb("connections")
      .where("codLocal", codLocal)
      .select("*");
      
      const items = porLocal[codLocal];

      // Obtener la conexión de ese local
      const conn = await getConnectionById(LocalID[0].id);
      
      if (!conn) {
        console.log(`⚠️ Sin conexión registrada para local ${codLocal}`);
        continue;
      }

      const config = makeMssqlConfig(conn.host);
      

      let pool;
      try {
        pool = await sql.connect(config);
      } catch {
        console.log(`⏳ Local ${codLocal} aún no está online`);
        continue;
      }

      // 4️⃣ Actualizar cada artículo
      for (const item of items) {
        try {
          await pool.request()
            .input("codigo", sql.VarChar(100), item.articuloCodigo)
            .query(`
              UPDATE articulo
              SET Web = 1
              WHERE Codigo = @codigo
                AND grupo11 > 0
            `);

          // 5️⃣ Registrar en log de corrección
          await mgmtDb("logs").insert({
            username: "SYSTEM",
            codLocal,
            articuloCodigo: item.articuloCodigo,
            campo: "Web",
            valorNuevo: true,
            requiereCorreccion: false,
            corregido: true
          });

          // 6️⃣ Marcar registro original como corregido
          await mgmtDb("logs")
            .where("id", item.id)
            .update({ corregido: true });

          console.log(`✅ Arreglo OK → Local ${codLocal} Art ${item.articuloCodigo}`);

        } catch (err) {
          console.log(`❌ Error corrigiendo articulo ${item.articuloCodigo}`, err.message);
        }
      }

      await pool.close();
    }

    console.log("🏁 Proceso de reparación terminado");

  } catch (err) {
    console.error("❌ Error en tarea automática:", err);
  }
}

// 🕒 Programar: todos los días 10:35 AM
cron.schedule("58 09 * * *", runFixOfflineUpdates);

if (process.env.RUN_FIX_NOW === "true") {
  console.log("🚀 Ejecutando reparación manual inmediata...");
  runFixOfflineUpdates();
}
export default runFixOfflineUpdates;
