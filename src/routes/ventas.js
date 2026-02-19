// routes/ventas.js
import express from "express";
import mgmtDb from "../db/adminDb.js";
import  {getCentralPool }  from "../db/dbCentral.js";
import sql from "mssql";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { requireAuth } from "../middleware/auth.js";
import { getConnectionById, makeMssqlConfig } from "../db/connections.js";


const router = express.Router();

router.use(requireAuth);

router.get("/ventas-diarias", allowRoles("Admin"), async (req, res) => {
  try {

    /* =========================
       1️⃣ OBTENER LOCALES
    ========================== */
    const connections = await mgmtDb("connections")
      .select("name", "host", "codLocal");

    /* =========================
       2️⃣ CONSULTA CENTRAL (UNA SOLA VEZ)
    ========================== */
    const poolCentral = await getCentralPool();

    const centralResult = await poolCentral
      .request()
      .query(`
        SELECT 
          Local,
          COUNT(*) AS cantidad,
          ISNULL(SUM(total), 0) AS total
        FROM emitidos
        WHERE anulado = 0
          AND CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)
        GROUP BY Local
      `);

    // Convertimos en mapa para búsqueda rápida
    const centralMap = new Map();

    centralResult.recordset.forEach(r => {
      centralMap.set(r.Local, {
        cantidad: r.cantidad,
        total: r.total
      });
    });

    const resultado = [];

    /* =========================
       3️⃣ ITERAR POR CADA LOCAL
    ========================== */
    for (const c of connections) {

      let localTotal = 0;
      let localCantidad = 0;

      const config = makeMssqlConfig(c.host);

      try {
        const localPool = await sql.connect(config);

        const r = await localPool
          .request()
          .query(`
            SELECT 
              COUNT(*) AS cantidad,
              ISNULL(SUM(total), 0) AS total
            FROM emitidos
            WHERE anulado = 0
              AND CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)
          `);

        localCantidad = r.recordset[0].cantidad;
        localTotal = r.recordset[0].total;

        await localPool.close();

      } catch (err) {
        console.error(`❌ Error local ${c.codLocal}:`, err.message);
      }

      /* =========================
         4️⃣ OBTENER DATA CENTRAL DESDE MAP
      ========================== */
      const centralData = centralMap.get(c.codLocal) || {
        cantidad: 0,
        total: 0
      };

      resultado.push({
        codLocal: c.codLocal,
        name: c.name,
        local: {
          cantidad: localCantidad,
          total: localTotal,
        },
        central: centralData,
        diferencia: {
          cantidad: localCantidad - centralData.cantidad,
          total: localTotal - centralData.total,
        },
      });
    }

    res.json(resultado);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error conciliando ventas" });
  }
});

export default router;