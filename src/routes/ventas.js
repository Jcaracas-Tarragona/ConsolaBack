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

router.get("/ventas-diarias", allowRoles("Admin","Zonal","Comercial"), async (req, res) => {

  try {

    const user = req.user; // viene del middleware de autenticación

    /* 1️⃣ OBTENER LOCALES */

    let connectionsQuery = mgmtDb("connections")
      .select("name", "host", "codLocal");

    // Si es zonal filtrar por su usuario
    if (user.role === "Zonal") {
      connectionsQuery = connectionsQuery.where("zonal", user.id);
    }

    const connections = await connectionsQuery;

    /* 2️⃣ CONSULTA CENTRAL (UNA SOLA VEZ) */

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

    const centralMap = new Map();

    centralResult.recordset.forEach(r => {
      centralMap.set(r.Local, {
        cantidad: r.cantidad,
        total: r.total
      });
    });

    const resultado = [];

    /* 3️⃣ ITERAR POR CADA LOCAL*/

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

      /* 4️⃣ OBTENER DATA CENTRAL */

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

    res.status(500).json({
      message: "Error conciliando ventas"
    });

  }

});


router.get("/estado-horario", allowRoles("Admin"), async (req, res) => {

  try {
    /* CONEXIÓN CENTRAL */
    const pool = await getCentralPool();

    /* CONSULTA AGRUPADA */
    const result = await pool.request().query(`
      SELECT   e.Local, l.Nom_local AS nombreLocal,
        -- Última fecha/hora como TEXTO (evita desfase)
            CONVERT(varchar(19),
                MAX(
                    DATEADD(SECOND,
                        DATEDIFF(SECOND,'00:00:00',e.hora),
                        CAST(e.fecha AS DATETIME)
                    )
                ),
            120) AS ultimaFecha,
            -- Diferencia en minutos
            DATEDIFF(
                MINUTE,
                MAX(
                    DATEADD(SECOND,
                        DATEDIFF(SECOND,'00:00:00',e.hora),
                        CAST(e.fecha AS DATETIME)
                    )
                ),
                GETDATE()
            ) AS minutos,
            CASE
                -- No hay ventas hoy
                WHEN MAX(e.fecha) < CAST(GETDATE() AS DATE)
                    THEN 'Sin ventas hoy'
                -- En horario
                WHEN DATEDIFF(
                    MINUTE,
                    MAX(
                        DATEADD(SECOND,
                            DATEDIFF(SECOND,'00:00:00',e.hora),
                            CAST(e.fecha AS DATETIME)
                        )
                    ),
                    GETDATE()
                ) <= 10
                    THEN 'En horario'
                -- Demora leve
                WHEN DATEDIFF(
                    MINUTE,
                    MAX(
                        DATEADD(SECOND,
                            DATEDIFF(SECOND,'00:00:00',e.hora),
                            CAST(e.fecha AS DATETIME)
                        )
                    ),
                    GETDATE()
                ) BETWEEN 11 AND 59
                    THEN 'Demora leve'
                -- Critica
                ELSE 'Critica'
            END AS estado
        FROM emitidos e
        LEFT JOIN locales l ON e.Local = l.Num_local
        WHERE e.anulado = 0
        GROUP BY e.Local, l.Nom_local
        ORDER BY e.Local;
    `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message:"Error consultando horarios"
    });
  }
});

router.get("/estado-horario/resumen", allowRoles("Admin"), async (req, res) => {
  try {
    const pool = await getCentralPool();

    const result = await pool.request().query(`
      SELECT estado, COUNT(*) AS cantidad
      FROM (
        SELECT
          CASE
            WHEN MAX(e.fecha) < CAST(GETDATE() AS DATE)
              THEN 'Sin ventas hoy'
            WHEN DATEDIFF(
              MINUTE,
              MAX(
                DATEADD(SECOND,
                  DATEDIFF(SECOND,'00:00:00',e.hora),
                  CAST(e.fecha AS DATETIME)
                )
              ),
              GETDATE()
            ) <= 10
              THEN 'En horario'
            WHEN DATEDIFF(
              MINUTE,
              MAX(
                DATEADD(SECOND,
                  DATEDIFF(SECOND,'00:00:00',e.hora),
                  CAST(e.fecha AS DATETIME)
                )
              ),
              GETDATE()
            ) BETWEEN 11 AND 59
              THEN 'Demora leve'
            ELSE 'Critica'
          END AS estado
        FROM emitidos e
        LEFT JOIN locales l ON e.Local = l.Num_local
        WHERE e.anulado = 0
        GROUP BY e.Local, l.Nom_local
      ) AS sub
      GROUP BY estado
      ORDER BY estado;
    `);

    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error generando resumen de estados"
    });
  }
});


export default router;