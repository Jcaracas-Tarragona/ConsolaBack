import cron from "node-cron";
import db from "../db/adminDb.js";
import { enviarCorreoAlerta } from "../services/mailService.js";


/**
 * =====================================================
 * EMPRESAS A CONSULTAR
 * =====================================================
 *
 * El id corresponde al parámetro que recibe
 * /estado-horario/resumen.
 *
 * 1 -> QA
 * 3 -> EMPRESA2
 */

const EMPRESAS = [
  {
    id: 1,
    nombre: "TARRAGONA"
  },
  {
    id: 3,
    nombre: "ELEMENTAL - PS"
  }
];


/**
 * =====================================================
 * CONSULTAR ESTADO DE UNA EMPRESA
 * =====================================================
 */

async function consultarEmpresa(empresa) {

  const url =
    `http://localhost:3000/actualizaciones/estado-horario/resumen` +
    `?empresa_id=${empresa.id}`;

  const res = await fetch(url, {
    headers: {
      "x-api-key": process.env.API_KEY
    }
  });


  if (!res.ok) {
    throw new Error(
      `Error consultando ${empresa.nombre} (${res.status})`
    );
  }


  const response = await res.json();

  const data = Array.isArray(response.data)
    ? response.data
    : [];


  /**
   * Agregamos información de empresa
   * para poder identificar posteriormente
   * de dónde viene cada alerta.
   */

  return data.map(item => ({
    ...item,

    empresa_id: empresa.id,
    empresa_nombre: empresa.nombre,

    /**
     * Dejamos un nombre uniforme.
     *
     * El endpoint puede devolver actualmente
     * Nom_local o nombreLocal según la consulta.
     */
    nombreLocal:
      item.nombreLocal ||
      item.Nom_local ||
      item.name ||
      "Sin nombre"
  }));
}


/** INICIALIZAR CRON */

export const initCronJobs = () => {

  /**
   * Ejecutar:
   *
   * 13:30
   * 15:30
   */

  cron.schedule(
    "30 13,15 * * *",
    async () => {
      try {
        /** CONSULTAR TODAS LAS EMPRESAS */
        const resultados = [];

        for (const empresa of EMPRESAS) {
          try {
            const dataEmpresa =
              await consultarEmpresa(
                empresa
              );

            resultados.push(
              ...dataEmpresa
            );

          } catch (error) {
            /**
             * Si falla una empresa no detenemos
             * la consulta de las demás.
             */
            console.error(
              `❌ Error consultando ${empresa.nombre}:`,
              error.message
            );
          }
        }


        /**
         * =================================================
         * FILTRAR ALERTAS
         * =================================================
         *
         * Cerrado NO genera alerta.
         */

        const alertas =
          resultados.filter(item =>
            item.estado === "Critica" ||
            item.estado === "Sin ventas hoy"
          );


        if (alertas.length === 0) {

          return;
        }


        /**
         * =================================================
         * CONTADORES GENERALES
         * =================================================
         */

        const sinVentas =
          alertas.filter(
            item =>
              item.estado === "Sin ventas hoy"
          ).length;

        const critica =
          alertas.filter(
            item =>
              item.estado === "Critica"
          ).length;


        /**
         * =================================================
         * RESUMEN POR EMPRESA
         * =================================================
         */

        const resumenEmpresas =
          EMPRESAS.map(empresa => {
            const alertasEmpresa = alertas.filter( item => item.empresa_id === empresa.id );


            return {
              ...empresa,

              total: alertasEmpresa.length,
              sinVentas:
                alertasEmpresa.filter(
                  item =>
                    item.estado ===
                    "Sin ventas hoy"
                ).length,
              critica:
                alertasEmpresa.filter(
                  item =>
                    item.estado ===
                    "Critica"
                ).length
            };
          }).filter(
            empresa =>
              empresa.total > 0
          );


        /**
         * =================================================
         * TEXTO NOTIFICACIÓN
         * =================================================
         */

        const detalleEmpresas =
          resumenEmpresas
            .map(empresa =>
              `${empresa.nombre}: ` +
              `${empresa.sinVentas} sin ventas, ` +
              `${empresa.critica} críticos`
            )
            .join(" | ");


        const contenido =
          `${sinVentas} locales Sin ventas hoy, ` +
          `${critica} locales con demora Crítica. ` ;


        /**
         * =================================================
         * GUARDAR NOTIFICACIÓN
         * =================================================
         */

        await db("notificaciones")
          .insert({ titulo: "Alerta de estado de locales",
            contenido,
            leido: false,
            url: "ultima-venta",
            created_at: new Date()
          });


        /**
         * =================================================
         * FILAS EMAIL
         * =================================================
         */

        const htmlRows =
          alertas.map(item => {

            const color =
              item.estado === "Critica"
                ? "#dc3545"
                : "#fd7e14";


            return `
              <tr>
                <td style="padding:8px; border:1px solid #ddd; ">
                  ${item.empresa_nombre}
                </td>

                <td style="padding:8px; border:1px solid #ddd; ">
                  ${item.codLocal ?? "-"}
                </td>

                <td style="padding:8px; border:1px solid #ddd; ">
                  ${item.nombreLocal}
                </td>

                <td style=" padding:8px; border:1px solid #ddd; color:${color}; font-weight:bold; ">
                  ${item.estado}
                </td>

              </tr>
            `;

          }).join("");


        /**
         * =================================================
         * RESUMEN HTML POR EMPRESA
         * =================================================
         */

        const htmlResumenEmpresas =
          resumenEmpresas
            .map(empresa => `
              <li>
                <strong>${empresa.nombre}</strong>:
                ${empresa.sinVentas} sin ventas,
                ${empresa.critica} críticos
              </li>
            `)
            .join("");


        /**
         * =================================================
         * EMAIL
         * =================================================
         */

        const html = `
          <div style="font-family:Arial,sans-serif;padding:20px;">
            <h2 style="color:#dc3545;">
              🚨 Resumen Monitoreo Ventas
            </h2>
            <p>
              Se detectaron
              <strong>${alertas.length}</strong>
              locales con problemas de distribución.
            </p>

            <ul>
              ${htmlResumenEmpresas}
            </ul>

            <table style=" border-collapse:collapse; width:100%; ">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="padding:8px; border:1px solid #ddd; ">
                    Empresa
                  </th>

                  <th style="padding:8px; border:1px solid #ddd; ">
                    Código
                  </th>

                  <th style="padding:8px; border:1px solid #ddd; ">
                    Local
                  </th>

                  <th style="padding:8px; border:1px solid #ddd; ">
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
              Por favor contactar a N2 para revisar
              el Distribuidor y realizar seguimiento
              de venta.
            </p>

          </div>
        `;


        await enviarCorreoAlerta({
          subject: `🚨 ${alertas.length} locales con problemas de Distribución`,
          html,
          to:"mesadeayuda@tarragona.cl"
        });


        /*console.log("📧 Notificación y correo generados correctamente.");*/


      } catch (error) {

        console.error(
          "❌ Error en cron de distribución:",
          error
        );

      }

    },
    {
      timezone:
        "America/Santiago"
    }
  );

};