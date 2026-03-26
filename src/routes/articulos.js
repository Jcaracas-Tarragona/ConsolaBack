import express from "express";
import mgmtDb from "../db/adminDb.js";
import  {getCentralPool }  from "../db/dbCentral.js";
import {allowRoles} from "../middleware/roleMiddleware.js";
import { requireAuth } from "../middleware/auth.js";
import { logMenuChange } from "../services/menuLogs.service.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";


const router = express.Router();

function agruparArticulos(rows) {
  const mapa = {};

  rows.forEach(r => {
    if (!mapa[r.codigo_combo]) {
      mapa[r.codigo_combo] = {
        codigo: r.codigo_combo,
        articulo: r.articulo,
        agregador: r.agregador,
        menu_disponible: r.menu_disponible,
        precio: r.precio,
        detalles: []
      };
    }

    if (r.codigo_detalle) {
      mapa[r.codigo_combo].detalles.push({
        codigo: r.codigo_detalle,
        detalle: r.detalle,
        base: r.base,
        activo: r.activo
      });
    }
  });

  return Object.values(mapa);
}

router.get("/", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 15);
  const search = req.query.search || "";

  try {
    const baseQuery = mgmtDb("articulos");

    if (search) {
      baseQuery.whereILike("descripcion", `%${search}%`);
    }

    const [{ count }] = await baseQuery.clone().count("*");

    const items = await baseQuery
      .select("*")
      .limit(limit)
      .offset((page - 1) * limit)
      .orderBy("descripcion");

    res.json({
      items,
      total: Number(count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error cargando artículos" });
  }
});

router.get("/articuloServer",async(req, res)=>{
  try {
    /* CONEXIÓN CENTRAL */
    const pool = await getCentralPool();

    /* CONSULTA AGRUPADA */
    const result = await pool.request().query(`
      SELECT   ar.codigo, ar.Descrip
        FROM articulo ar
        WHERE ar.rubro=19 AND ar.Codigoerp IS NOT NULL
          AND ar.Codigoerp <> ''
        ORDER BY ar.Descrip;
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message:"Error consultando Articulos"
    });
  }
});

router.get("/:codigo", async (req, res) => {
  const art = await mgmtDb("articulos")
    .where({ codigo: req.params.codigo })
    .first();

  if (!art) return res.status(404).json({ error: "No existe" });
  res.json(art);
});

router.get("/detalle/:codigo_combo", async (req, res) => {
  const { codigo_combo } = req.params;  
  try {
    const items = await mgmtDb("detalle_articulos")
      .select("codigo_combo","codigo", "detalle as descrip","base","cant" )
      .where({ codigo_combo })
      .orderBy("base", "desc");  
    

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo detalle" });
  } 
});

router.get("/export/excel/:codigo", allowRoles("Admin","Comercial"), async (req, res) => {
  try {
    const rows = await mgmtDb.raw(`
      SELECT 
        a.codigo AS codigo_combo,
        a.descripcion AS articulo,
        d.codigo AS codigo_detalle,
        d.detalle,
        d.base,
        concat_ws(', ',
            CASE WHEN a.pya = true THEN 'PedidosYa' END,
            CASE WHEN a.rappi = true THEN 'Rappi' END,
            CASE WHEN a.uber = true THEN 'Uber' END
        ) AS agregador,
        concat_ws(', ',
            CASE WHEN a."disponibleA" = true THEN 'A' END,
            CASE WHEN a."disponibleB" = true THEN 'B' END,
            CASE WHEN a."disponibleC" = true THEN 'C' END
        ) AS menu_disponible,
        a."precioA" as Precio
      FROM articulos a
      LEFT JOIN detalle_articulos d
        ON a.codigo = d.codigo_combo
        WHERE a.codigo = ?

      ORDER BY d.detalle
    `,[req.params.codigo]);

    const data = agruparArticulos(rows.rows);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte Articulos");

    /* TITULO */

    sheet.mergeCells("A1:F1");

    const title = sheet.getCell("A1");
    title.value = "REPORTE DE ARTÍCULOS Y COMPONENTES";
    title.font = { size: 16, bold: true };
    title.alignment = { horizontal: "center" };

    sheet.addRow([]);

    /*  ENCABEZADOS */

    const headerRow = sheet.addRow([
      "Código",
      "Artículo / Componente",
      "Código Detalle",
      "Base",
      "Agregador",
      "Menu Disponible",
      "Precio"
    ]);

    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" }
      };
      cell.alignment = { horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    /*  DATOS */

    data.forEach(a => {

      const rowArticulo = sheet.addRow([
        a.codigo,
        a.articulo,
        "",
        "",
        a.agregador
        ,a.menu_disponible,
        a.precio
      ]);

      rowArticulo.font = { bold: true };

      rowArticulo.eachCell(cell => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE7F1FF" }
        };
      });

      a.detalles.forEach(d => {

        const row = sheet.addRow([
          "",
          d.detalle,
          d.codigo,
          d.base ? "Sí" : "No",
          "",
          "",
          ""
        ]);

        row.eachCell(cell => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        });

      });

      sheet.addRow([]);

    });

    /* FORMATO COLUMNAS */

    sheet.columns = [
      { width: 15 },
      { width: 40 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 15 },
      { width: 10 }
    ];

    sheet.autoFilter = {
      from: "A3",
      to: "G3"
    };

    /*  RESPUESTA */

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=reporte_articulos.xlsx"
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Error generando Excel"
    });

  }

});


router.get("/export/pdf/:codigo", allowRoles("Admin","Comercial"), async (req, res) => {
  try {
    const { codigo } = req.params;
    const rows = await mgmtDb.raw(`
      SELECT
        a.codigo,
        a.nombre AS nombre_articulo,
        a.fecha_inicio AS fecha_publicacion,
        a.updated_at AS fecha_solicitud,
        a.posicion,
        a.categoria,
        concat_ws(', ',
            CASE WHEN a.pya = true THEN 'PedidosYa' END,
            CASE WHEN a.rappi = true THEN 'Rappi' END,
            CASE WHEN a.uber = true THEN 'Uber' END
        ) AS agregador,
        concat_ws(', ',
            CASE WHEN a."disponibleA" = true THEN 'A' END,
            CASE WHEN a."disponibleB" = true THEN 'B' END,
            CASE WHEN a."disponibleC" = true THEN 'C' END
        ) AS menu_disponible,
        a."precioA" as precio,
        d.codigo AS codigo_detalle,
        d.detalle,
        d.base,
        d.activo

      FROM articulos a
      LEFT JOIN detalle_articulos d
        ON a.codigo = d.codigo_combo

      WHERE a.codigo = ?

      ORDER BY d.detalle
    `,[codigo]);

    const data = rows.rows;

    if(data.length === 0){
      return res.status(404).json({error:"Artículo no encontrado"});
    }

    const articulo = data[0];

    const doc = new PDFDocument({
      margin:40,
      size:"A4"
    });

    res.setHeader("Content-Type","application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=articulo_${codigo}.pdf`
    );

    doc.pipe(res);

    /* TITULO */

    doc
      .fontSize(18)
      .text("FICHA DE SOLICITUD COMERCIAL", {align:"center"});

    doc.moveDown(2);

    /*  DATOS ARTICULO */

    doc.fontSize(11);

    doc.text(`Código: ${articulo.codigo}`);
    doc.text(`Nombre: ${articulo.nombre_articulo}`);
    doc.text(`Categoría: ${articulo.categoria}`);
    doc.text(`Posición: ${articulo.posicion}`);

    doc.moveDown();

    doc.text(`Fecha publicación: ${new Date(articulo.fecha_publicacion).toISOString().slice(0,10)}`);
    doc.text(`Fecha Solicitud: ${new Date(articulo.fecha_solicitud).toISOString().slice(0,10)}`);
    doc.text(`Agregadores: ${articulo.agregador || "-"}`);
    doc.text(`Menú Disponible: ${articulo.menu_disponible || "-"}`);
    doc.text(`Precio: $${Number(articulo.precio).toLocaleString("es-CL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`);

    doc.moveDown(2);

    const tableTop = doc.y + 10;

    const colCodigo = 40;
    const colDetalle = 120;
    const colBase = 400;
    const colActivo = 470;

    const rowHeight = 25;

    /* HEADER */

    doc.font("Helvetica-Bold");

    doc.text("Código", colCodigo, tableTop);
    doc.text("Detalle", colDetalle, tableTop);
    doc.text("Base", colBase, tableTop);
    doc.text("Activo", colActivo, tableTop);

    doc.moveTo(40, tableTop + 15)
      .lineTo(550, tableTop + 15)
      .stroke();

    doc.font("Helvetica");

    /* FILAS */

    let y = tableTop + 25;

    data.forEach(d => {

      if (!d.codigo_detalle) return;

      doc.text(d.codigo_detalle, colCodigo, y, {
        width: 70,
        align: "left"
      });

      doc.text(d.detalle, colDetalle, y, {
        width: 260,
        align: "left"
      });

      doc.text(d.base ? "Sí" : "No", colBase, y, {
        width: 50,
        align: "center"
      });

      doc.text(d.activo ? "Sí" : "No", colActivo, y, {
        width: 50,
        align: "center"
      });

      y += rowHeight;

    });
  doc.end();

  } catch(err){

    console.error(err);

    res.status(500).json({
      error:"Error generando PDF"
    });

  }

});

router.post("/", async (req, res) => {
  const {articulos, codigo, descripcion, disponibleA, disponibleB, disponibleC, fecha_inicio, 
  nombre, precioA, precioB, precioC, categoria, posicion, pya, uber, rappi} = req.body;

  
  await mgmtDb("articulos").insert({codigo, descripcion, disponibleA, disponibleB, disponibleC, fecha_inicio, 
  nombre, precioA, precioB, precioC, categoria, posicion, pya, uber, rappi});

  // recorrer artículos seleccionados
  for (const art of articulos) {

    await mgmtDb("detalle_articulos").insert({
      codigo_combo: codigo,
      codigo: art.codigo,
      detalle: art.descrip,
      activo: true,
      base: art.base || false,
      cant: art.cant || 1
    });

  }
  
  await logMenuChange({
    entidad: "articulo",
    entidadId: codigo,
    campo: "CREATED",
    valorNuevo: JSON.stringify({codigo, descripcion, disponibleA, disponibleB, disponibleC, fecha_inicio, 
  nombre, precioA, precioB, precioC, categoria, posicion, pya, uber, rappi}),
    usuario: req.user.username,
    rol: req.user.role
  });

  res.status(201).json({ ok: true });
});

router.patch("/:codigo", async (req, res) => {
  const { codigo } = req.params;
  const cambios = req.body;

  const actual = await mgmtDb("articulos").where({ codigo }).first();  

  if (!actual) {
    return res.status(404).json({ error: "Artículo no existe" });
  }

  await mgmtDb("articulos")
    .where({ codigo })
    .update({
      ...cambios,
      updated_at: new Date()
    });

  for (const campo of Object.keys(cambios)) {
    await logMenuChange({
      entidad: "articulo",
      entidadId: codigo,
      campo,
      valorAnterior: actual[campo],
      valorNuevo: cambios[campo],
      usuario: req.user.username,
      rol: req.user.role
    });
  }

  res.json({ ok: true });
});
// Eliminar artículo (y su detalle)
router.delete("/:codigo", async (req, res) => {
  await mgmtDb("articulos").where({ codigo: req.params.codigo }).del();

  await mgmtDb("logs_menu").insert({
    entidad: "articulo",
    entidad_id: req.params.codigo,
    campo: "DELETED",
    usuario: req.user.username,
    rol: req.user.role
  });

  await mgmtDb("detalle_articulos").where({ codigo_combo: req.params.codigo }).del();

  res.json({ ok: true });
});

router.patch("/:id/estado", async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  const user = req.user;

  if (typeof activo !== "boolean") {
    return res.status(400).json({ error: "activo debe ser boolean" });
  }

  await mgmtDb("articulos").where({ id }).update({ activo });

  await logMenuChange({
    entidad: "articulo",
    entidadId: id,
    campo: "UDTATE_ACTIVO",
    valorAnterior: activo ? false : true,
    valorNuevo: activo,
    usuario: user.username,
    rol: user.role,
  });

  res.json({ ok: true });
});

// routes/articulos.js
router.put("/:id", requireAuth, allowRoles("Admin", "Comercial"), async (req, res) => {
  const { id } = req.params;
  const { articulos, codigo, descripcion, disponibleA, disponibleB, disponibleC, fecha_inicio, 
    nombre, precioA, precioB, precioC, categoria, posicion, pya, uber, rappi } = req.body;
  const user = req.user;
  

  try {
    // 1️⃣ Obtener estado anterior
    const prev = await mgmtDb("articulos").where({ id }).first();
    if (!prev) return res.status(404).json({ error: "Artículo no existe" });

    // 2️⃣ Actualizar
    await mgmtDb("articulos").where({ id }).update({ codigo,descripcion, disponibleA, disponibleB, disponibleC, fecha_inicio, 
  nombre, precioA, precioB, precioC, categoria, posicion, pya, uber, rappi });

    // 3️⃣ Comparar campos y logear SOLO los que cambian
    const camposLogeables = [ "descripcion", "precioA", "precioB", "precioC", "disponibleA",
      "disponibleB", "disponibleC", "activo", "fecha_inicio", "fecha_fin", "categoria", "posicion", "pya", "uber", "rappi" ];

    for (const campo of camposLogeables) {
      if (prev[campo] !== req.body[campo]) {
        await logMenuChange({
          entidad: "articulo",
          entidadId: id,
          campo: "UPDATE" ,
          valorAnterior: prev[campo],
          valorNuevo: req.body[campo],
          usuario: user.username,
          rol: user.role,
        });
      }
    }

    try {
      await mgmtDb.transaction(async trx => {
        await trx("detalle_articulos")
          .where({ codigo_combo: codigo })
          .del();

        const dataInsert = articulos.map(a => ({
          codigo_combo: codigo,
          codigo: a.codigo,
          detalle: a.descrip,
          activo: true,
          base: a.base || false,
          cant: a.cant || 1
        }));


        await trx("detalle_articulos").insert(dataInsert);
      });
      return res.json({ ok: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Error guardando detalle de artículos"
      });

    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error actualizando artículo" });
  }
});

// obtener componentes de un combo
router.get("/:codigo_combo", async (req, res) => {

  const { codigo_combo } = req.params;

  try {

    const items = await mgmtDb("detalle_articulos")
      .where({ codigo_combo })
      .orderBy("detalle");

    res.json(items);

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Error obteniendo detalle" });

  }

});

//Insertar o actualizar artículo en combo
router.get("/:codigo_combo", async (req, res) => {

  const { codigo_combo } = req.params;

  try {

    const items = await mgmtDb("detalle_articulos")
      .where({ codigo_combo })
      .orderBy("detalle");

    res.json(items);

  } catch (err) {

    console.error(err);
    res.status(500).json({ error: "Error obteniendo detalle" });

  }

});

export default router;
