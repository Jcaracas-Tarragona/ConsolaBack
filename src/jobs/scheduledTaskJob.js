import cron from "node-cron";
import runScheduledTasks  from "../services/scheduledTaskRunner.js";

export const initScheduledTaskJob = () => {

    // 08:00 todos los días
    cron.schedule("03 13 * * *", async () => {

        console.log("⏰ Ejecutando Activaciones/Desactivaciones de Productos...");

        await runScheduledTasks();

    });

};