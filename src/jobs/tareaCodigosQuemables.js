import cron from "node-cron";
import ejecutarTareaCodigosQuemables from "../services/tareaCodigosQuemables.js";

/*
    ┌───────────── minuto (0)
    │ ┌─────────── hora (08)
    │ │ ┌───────── día del mes (1)
    │ │ │ ┌─────── mes (*)
    │ │ │ │ ┌───── día de la semana (*)
    │ │ │ │ │
    0 8 1 * *
*/
export const tareaCodigosQuemables = () => {
    cron.schedule(
    "30 08 1 * *",
    async () => {
        console.log("INICIANDO TAREA CODIGOS QUEMABLES");;

        await ejecutarTareaCodigosQuemables();

    },
    {
        timezone: "America/Santiago"
    }
    );
}