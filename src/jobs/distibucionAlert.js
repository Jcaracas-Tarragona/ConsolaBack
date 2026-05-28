import cron from "node-cron";
import db from "../db/adminDb.js"; // tu instancia de knex

// Si usas Node 18+ ya tienes fetch nativo
// si no: import fetch from "node-fetch";

export const initCronJobs = () => {
  // 11:30 y 15:30
  cron.schedule("30 13,15 * * *", async () => {
    console.log("⏰ Ejecutando tarea programada...");

   try {
      const res = await fetch("http://localhost:3000/actualizaciones/estado-horario/resumen", {
        headers: {
            "x-api-key": process.env.API_KEY
        }
      });

      const data = await res.json();
      //console.log("📊 Datos recibidos:", data);

      // extraer valores
      const sinVentas = data.data.filter( e => e.estado === "Sin ventas hoy").length;
      const critica = data.data.filter(e => e.estado === "Critica").length;
      // solo guardar si hay problemas
      if (sinVentas > 0 || critica > 0) {

        const contenido = `${sinVentas} locales Sin ventas hoy, ${critica} locales con demora Critica`;

        // evitar duplicados
        const ultima = await db("notificaciones")
          .orderBy("created_at", "desc")
          .first();

        if (!ultima || ultima.contenido !== contenido) {
          await db("notificaciones").insert({
            titulo: "Alerta de estado de locales",
            contenido,
            leido: false,
            created_at: new Date()
          });

          console.log("🔔 Notificación generada:", contenido);
        } else {
          console.log("⏭️ Sin cambios, no se genera notificación");
        }

      } else {
        console.log("✅ Sin problemas, no se genera notificación");
      }

    } catch (error) {
      console.error("❌ Error en cron:", error);
    }
  });
};