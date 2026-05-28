// src/routes/reports.js
import express from "express";
import mgmtDb from "../db/adminDb.js";
import ExcelJS from "exceljs";
import {allowRoles} from "../middleware/roleMiddleware.js";

const router = express.Router();

function parseDateRange(q) {
  const today = new Date();

  // Si viene date_from o date_to, tratarlas como fechas locales (sin shift de zona)
  const parseLocalDate = (str) => {
    if (!str) return null;
    const [year, month, day] = str.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  let dateTo = parseLocalDate(q.date_to) || today;
  let dateFrom = parseLocalDate(q.date_from);

  if (!dateFrom) {
    dateFrom = new Date(dateTo);
    dateFrom.setDate(dateTo.getDate() - 13);
  }

  // 🔹 Forzar límites del día en horario local real
  dateFrom.setHours(0, 0, 0, 0);
  dateTo.setHours(23, 59, 59, 999);

  return { dateFrom, dateTo };
}



router.get("/productosagotados",allowRoles("Admin"), async (req, res) => {
  try {
    let { dateFrom: desde, dateTo: hasta } =  parseDateRange(req.query);
    let { limit } = req.query;
    limit = parseInt(limit) || 10; 

    // 🔥 VALIDACIÓN + DEFAULTS
    const hoy = new Date().toISOString().split("T")[0];

    if (!desde) desde = hoy;
    if (!hasta) hasta = desde;

    // 🔥 NORMALIZAR RANGO (hasta incluye todo el día)
    const hastaPlus = new Date(hasta);
    hastaPlus.setDate(hastaPlus.getDate() + 1);
    
    // 🔥 BASE QUERY OPTIMIZADA
    const baseQuery = mgmtDb("logs as l")
      .join("connections as c", function () {
        this.on(
          mgmtDb.raw('c."codLocal" = l."codLocal"::integer')
        );
      })
      .where("l.valorNuevo", false)
      .where("l.created_at", ">=", desde)
      .andWhere("l.created_at", "<", hastaPlus);

    // 🔥 TOP PRODUCTOS
    const productos = await baseQuery
      .clone()
      .select("l.nombre_articulo as producto")
      .count("* as cantidad")
      .groupBy("l.nombre_articulo")
      .orderBy("cantidad", "desc")
      .limit(limit);

    // 🔥 TOP LOCALES
    const locales = await baseQuery
      .clone()
      .select("c.name as local")
      .count("* as cantidad")
      .groupBy("c.name")
      .orderBy("cantidad", "desc")
      .limit(limit);

    // 🔥 DETALLE (LIMITADO para no romper frontend)
    const detalle = await baseQuery
      .clone()
      .select(
        "l.nombre_articulo as producto",
        "c.name as local",
        "l.created_at as fecha"
      )
      .orderBy("l.created_at", "desc")
      .limit(500);
    const dias = await baseQuery
      .clone()
      .select(
        mgmtDb.raw(`
          EXTRACT(DOW FROM l.created_at) as orden,
          TO_CHAR(l.created_at, 'Day') as dia
        `)
      )
      .count("* as cantidad")
      .groupBy("orden", "dia")
      .orderBy("orden");
            
    res.json({
      productos,
      locales,
      detalle,
      dias
    });

  } catch (error) {
    console.error("Error reporte agotados:", error);
    res.status(500).json({
      error: "Error generando reporte"
    });
  }
});

/**
 * 📊 GET /reports/incidence-by-day
 * Muestra agrupado por día y local, con los artículos OFF del período.
 */
router.get("/incidence-by-day", async (req, res) => {
  try {
    const { dateFrom, dateTo } = parseDateRange(req.query);
    
    const results = await mgmtDb("logs as l")
    .select(
      mgmtDb.raw(`date_trunc('day', l."created_at") as fecha`),
      mgmtDb.raw(`l."codLocal"`),
      mgmtDb.raw(`c."name" as "localName"`),
      mgmtDb.raw(`string_agg(distinct l."articuloCodigo"::text, ', ') as articulos`),
      mgmtDb.raw(`count(distinct l."articuloCodigo") as total_articulos`)
    )
    .leftJoin(
      "connections as c",
      mgmtDb.raw('CAST(c."codLocal" AS TEXT)'),
      "=",
      mgmtDb.raw('l."codLocal"')
    )
    .whereBetween("l.created_at", [dateFrom, dateTo])
    .andWhere("l.valorNuevo", false)
    .groupByRaw(`1, 2, 3`)
    .orderByRaw(`1 asc, 2 asc`);


    res.json({ success: true, data: results });
  } catch (err) {
    console.error("GET /reports/incidence-by-day error:", err);
    res.status(500).json({ success: false, message: "Error generando reporte agrupado" });
  }
});

/**
 * 📤 GET /reports/export?type=by_grouped
 * Exporta el mismo reporte a Excel
 */
router.get("/export", async (req, res) => {

    const { dateFrom, dateTo } = parseDateRange(req.query);
   try {

    const logs = await mgmtDb("logs")
      .select(
        mgmtDb.raw("to_char(created_at, 'YYYY-MM-DD') as fecha"),
        "codLocal",
        "nombre_articulo"
      )
      .count("* as veces")
      .where({
        valorNuevo: false,
        requiereCorreccion: true
      })
      .whereBetween("created_at", [dateFrom, dateTo])
      .groupByRaw("to_char(created_at, 'YYYY-MM-DD'), \"codLocal\", \"nombre_articulo\"")
      .orderBy(["codLocal","fecha"]);

    const connections = await mgmtDb("connections")
      .select("codLocal","name");

    const mapLocales = {};
    connections.forEach(c=>{
      mapLocales[c.codLocal] = c.name;
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Artículos Agotados");

    // ancho columnas
    sheet.columns = [
      { header:"Local", key:"local", width:25 },
      { header:"Fecha", key:"fecha", width:15 },
      { header:"Artículo", key:"articulo", width:45 },
      { header:"Veces", key:"veces", width:10 }
    ];

    // título
    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "REPORTE DE ARTÍCULOS AGOTADOS";
    sheet.getCell("A1").font = { size:16, bold:true };
    sheet.getCell("A1").alignment = { horizontal:"center" };

    // rango fechas
    sheet.mergeCells("A2:D2");
    sheet.getCell("A2").value = `Rango de fechas: ${new Date(dateFrom).toLocaleDateString()} a ${new Date(dateTo).toLocaleDateString()}`;
    sheet.getCell("A2").alignment = { horizontal:"center" };

    sheet.addRow([]);

    // encabezados
    const header = sheet.addRow(["Local","Fecha","Artículo","Veces"]);

    header.font = { bold:true };
    header.alignment = { horizontal:"center" };

    header.eachCell(cell=>{
      cell.fill = {
        type:"pattern",
        pattern:"solid",
        fgColor:{ argb:"FFBDD7EE" }
      };

      cell.border = {
        top:{style:"thin"},
        bottom:{style:"thin"},
        left:{style:"thin"},
        right:{style:"thin"}
      };
    });

    // congelar encabezado
    sheet.views = [{ state:"frozen", ySplit:4 }];

    let currentLocal = null;

    logs.forEach(row=>{

      const local = mapLocales[row.codLocal] || row.codLocal;

      const fila = sheet.addRow({
        local: currentLocal === local ? "" : local,
        fecha: row.fecha,
        articulo: row.nombre_articulo.trim(),
        veces: row.veces
      });

      fila.getCell("fecha").numFmt = "yyyy-mm-dd";

      currentLocal = local;

    });

    // bordes tabla
    sheet.eachRow((row, rowNumber)=>{

      if(rowNumber < 5) return;

      row.eachCell(cell=>{
        cell.border = {
          top:{style:"thin"},
          bottom:{style:"thin"},
          left:{style:"thin"},
          right:{style:"thin"}
        };
      });

    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=articulos_agotados_${dateFrom}_${dateTo}.xlsx`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false,
      message:err.message
    });

  }
});

router.get("/agotados-resumen", async (req, res) => {
  
  const { dateFrom, dateTo } = parseDateRange(req.query);
    
  const { fechaInicio, fechaFin } = req.query;

  if (!dateFrom || !dateTo) {
    return res.status(400).json({
      success: false,
      message: "Debe indicar fechaInicio y fechaFin"
    });
  }

  try {
    // 1️⃣ obtener resumen de logs
    const logs = await mgmtDb("logs")
      .select(mgmtDb.raw("to_char(created_at, 'YYYY-MM-DD') as fecha"), "codLocal", "articuloCodigo", "nombre_articulo")
      .count("* as veces")
      .where({
        valorNuevo: false,
        requiereCorreccion: true
      })
      .whereBetween("created_at", [dateFrom, dateTo])
      .groupByRaw("to_char(created_at, 'YYYY-MM-DD'), \"codLocal\",\"articuloCodigo\",\"nombre_articulo\"")
      .orderBy([
        { column: "fecha", order: "asc" },
        { column: "codLocal", order: "asc" }
      ]);

    // 2️⃣ obtener conexiones (nombre del local)
    const connections = await mgmtDb("connections")
      .select("codLocal", "name");

    const connMap = {};
    connections.forEach(c => {
      connMap[c.codLocal] = c.name;
    });

    // 3️⃣ agrupar por local
    const resultado = {};

    for (const row of logs) {
      const local = connMap[row.codLocal] || row.codLocal;
      if (!resultado[local]) {
        resultado[local] = [];
      }

      resultado[local].push({
        articuloCodigo: row.articuloCodigo,
        veces: row.veces,
        nombre_articulo: row.nombre_articulo,
        fecha: row.fecha
      });

    }

    res.json({
      success: true,
      data: resultado
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });

  }

});


export default router;
