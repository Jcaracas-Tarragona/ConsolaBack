import cron from "node-cron";
import mgmtDb from "../db/adminDb.js";
import sql from "mssql";
import { makeMssqlConfig } from "../db/connections.js";

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
      .select("id", "codLocal", "articuloCodigo");

    if (!pendientes.length) {
      console.log("✅ No hay artículos pendientes de corrección");
      return;
    }

    // 2️⃣ Agrupar por codLocal
    const pendientesPorLocal = new Map();

    for (const item of pendientes) {
        const key = String(item.codLocal);

        if (!pendientesPorLocal.has(key)) {
            pendientesPorLocal.set(key, []);
        }

        pendientesPorLocal.get(key).push(item);
    }
    
    //Consultar conexiones
    const conexiones = await mgmtDb("connections")
        .where("activo", true)
        .select("id", "codLocal", "name", "host");

    // 3️⃣ Procesar cada local
    for (const conn of conexiones ) {
      const articulos = pendientesPorLocal.get(String(conn.codLocal));
      
      if (!articulos || articulos.length === 0) {
        continue;
      }
      
      let pool;
      
      try {
          console.log(articulos);
          const config = makeMssqlConfig(conn.host);
          pool = await sql.connect(config);

          const nuevosLogs = [];
          const idsCorregidos = [];

          for (const articulo of articulos) {
              try {
                  await pool.request()
                      .input("codigo", sql.VarChar(100), articulo.articuloCodigo)
                      .query(`UPDATE articulo SET Web = 1 WHERE Codigo = @codigo AND grupo11 > 0 `);

                  idsCorregidos.push(articulo.id);

                  nuevosLogs.push({
                      username: "SYSTEM",
                      codLocal: conn.codLocal,
                      articuloCodigo: articulo.articuloCodigo,
                      campo: "Web",
                      valorNuevo: true,
                      requiereCorreccion: false,
                      corregido: true
                  });

              } catch (err) {

                  console.log(
                      `❌ ${articulo.articuloCodigo}`,
                      err.message
                  );

              }

          }
          if (nuevosLogs.length) {
              await mgmtDb("logs").insert(nuevosLogs);
          }
          if (idsCorregidos.length) {
            await mgmtDb("logs").whereIn("id", idsCorregidos)
                .update({corregido: true});
          }
                  
       } catch (error) {
          console.error(`❌ ${conn.name}`, error.message);

       } finally {
          if (pool) {
              await pool.close();
          }
      }

    }

    console.log("🏁 Proceso de reparación terminado");

  } catch (err) {
    console.error("❌ Error en tarea automática:", err);
  }
}

// 🕒 Programar: todos los días 10:35 AM
cron.schedule("50 09 * * *", runFixOfflineUpdates);

if (process.env.RUN_FIX_NOW === "true") {
  console.log("🚀 Ejecutando reparación manual inmediata...");
  runFixOfflineUpdates();
}
export default runFixOfflineUpdates;
