import cron from "node-cron";
import { monitorearTotems } from "../services/totemsStatusService.js";

let ultimaEjecucion = null;

/**
 * =====================================================
 * JOB MONITOREO TÓTEMS
 * =====================================================
 *
 * Desde las 10:00 hasta las 23:59.
 *
 * El cron despierta cada 10 minutos.
 *
 * Si todos los tótems están ON:
 *   → solamente ejecutamos una vez por hora.
 *
 * Si existe algún OFF:
 *   → ejecutamos cada 10 minutos.
 *
 */
export function totemsStatusJob() {

  cron.schedule(
    "*/10 11-20 * * *",
    async () => {

      const ahora = new Date();
      /**
      console.log(
        "\n[CRON] Iniciando revisión de tótems..."
      );

     
       * Si ya ejecutamos durante esta hora y
       * todos estaban ON, no volvemos a consultar.
       */
      if (ultimaEjecucion) {

        const diferencia = ahora.getTime() - ultimaEjecucion.fecha.getTime();

        /**
         * Si la última ejecución indicó que
         * todos estaban ON, esperamos 1 hora.
         */
        if ( ultimaEjecucion.todosOn && diferencia < 60 * 60 * 1000 ) {

          console.log(
            "[CRON] Todos los tótems estaban ON."
          );
          /*
          console.log(
            "[CRON] Próxima revisión dentro de 1 hora."
          );*/

          return;
        }
      }

      try {

        const resultado = await monitorearTotems();

        ultimaEjecucion = {fecha: ahora, todosOn: resultado.todosOn };

        console.log(
          `[CRON] Todos los tótems ON: ${resultado.todosOn}`
        );

      } catch (error) {

        console.error(
          "[CRON] Error durante el monitoreo:",
          error
        );

        /**
         * Si ocurre un error general no marcamos
         * todosOn=true.
         *
         * El siguiente ciclo de 10 minutos
         * volverá a intentarlo.
         */
        ultimaEjecucion = { fecha: ahora, todosOn: false };
      }
    },
    {
      timezone: "America/Santiago"
    }
  );

}