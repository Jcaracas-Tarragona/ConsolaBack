import cron from "node-cron";
import db from "../db/adminDb.js"; // tu instancia de knex
import { enviarCorreoAlerta } from "../services/mailService.js";

// Si usas Node 18+ ya tienes fetch nativo
// si no: import fetch from "node-fetch";

export const initCronJobs = () => {

  // Ejecutar a las 13:30 y 15:30
  cron.schedule("30 13,15 * * *", async () => {
    console.log("⏰ Ejecutando Resumen de Distribucion...");
    try {
      const res = await fetch(
        "http://localhost:3000/actualizaciones/estado-horario/resumen",
        {
          headers: {
            "x-api-key": process.env.API_KEY
          }
        }
      );

      if (!res.ok) {
        throw new Error(`Error consultando API (${res.status})`);
      }

      const response = await res.json();
      const data = response.data || [];
      const alertas = data.filter(x =>
        x.estado === "Critica" ||
        x.estado === "Sin ventas hoy"
      );

      const sinVentas = alertas.filter(
        x => x.estado === "Sin ventas hoy"
      ).length;

      const critica = alertas.filter(
        x => x.estado === "Critica"
      ).length;

      if (alertas.length === 0) {
        console.log("✅ Sin problemas, no se genera notificación.");
        return;
      }

      const contenido =
        `${sinVentas} locales Sin ventas hoy, ${critica} locales con demora Critica`;

      await db("notificaciones").insert({
        titulo: "Alerta de estado de locales",
        contenido,
        leido: false,
        url: "ultima-venta",
        created_at: new Date()
      });

      const htmlRows = alertas.map(x => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">
            ${x.codLocal}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${x.Nom_local}
          </td>

          <td
            style="
              padding:8px;
              border:1px solid #ddd;
              color:${x.estado === "Critica" ? "#dc3545" : "#fd7e14"};
              font-weight:bold;
            "
          >
            ${x.estado}
          </td>
        </tr>
      `).join("");

      const html = `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="color:#dc3545;">
            🚨 Resumen Monitoreo Ventas
          </h2>
          <p>
            Se detectaron <strong>${alertas.length}</strong> locales con problemas de distribución.
          </p>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px;border:1px solid #ddd;">
                  Código
                </th>
                <th style="padding:8px;border:1px solid #ddd;">
                  Local
                </th>
                <th style="padding:8px;border:1px solid #ddd;">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              ${htmlRows}
            </tbody>
          </table>
          <br>
          <p>
            Por favor contactar a N2 para revisar el Distribuidor y realizar seguimiento de venta.
          </p>
        </div>
      `;

      await enviarCorreoAlerta({
        subject: `🚨 ${alertas.length} locales con problemas de Distribución`,
        html,
        to: "mesadeayuda@tarragona.cl"
        // cc: "otra_cuenta@empresa.cl"
      });

      console.log("📧 Correo enviado correctamente.");

    } catch (error) {

      console.error("❌ Error en cron:", error);

    }

  });

};