// src/routes/connections.js
import express from "express";
import mgmtDb from "../db/adminDb.js";
import sql from "mssql";
import { requireAuth } from "../middleware/auth.js";
import { getConnectionById } from "../db/connections.js";
import { allowRoles } from "../middleware/roleMiddleware.js";


const router = express.Router();

router.use(requireAuth);

// Obtener locales sin zonal asignado 
router.get("/zonal/id/:userId",  async (req, res) => {
  try {
    const result = await mgmtDb("connections")
      .select("codLocal", "name","zonal","empresa_id")
      .where(function () {
        this.whereNull("zonal")
            .orWhere("zonal", req.params.userId);
      })
      .orderBy("name");

    // normalizar salida
    const data = result.map(l => ({
      codLocal: l.codLocal,
      name: l.name,
      asignado: l.zonal === Number(req.params.userId)
    }));

    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error obteniendo locales' });
  }
});


// listar conexiones
router.get("/", async (req, res) => {
  const userId = req.user.id;
  const role = req.user.role;

  let query = `SELECT c.id, c.name, c.host, c.created_by, c.created_at, c."codLocal", c.empresa_id FROM connections c`;
  const params = [];

  if (role === "Zonal") {
    query += ` WHERE c.zonal = ?`;
    params.push(userId);
  }
    
  const conns = await mgmtDb.raw(query, params);
  res.json(conns.rows);
});

/* LISTAR CONNECTIONS (con filtros opcionales) */
router.get("/paneladmin",  async (req, res) => {
  try {
    const { search = "", kiosko, kds, llamador } = req.query;

    const query = mgmtDb("connections")
      .select("id", "name", "host", "codLocal", "zonal",
        "kiosko", "ck", "kds", "c_kds", "llamador", "c_llamador", "created_at","activo", "rut", "razon_social","empresa_id")
      .orderBy("name", "asc");

    if (search) {
      query.where((q) => {
        q.whereILike("name", `%${search}%`)
          .orWhereILike("host", `%${search}%`)
          .orWhereRaw(`CAST("codLocal" AS TEXT) ILIKE ?`, [`%${search}%`]);
      });
    }

    if (kiosko !== undefined && kiosko !== "") {
      query.andWhere("kiosko", kiosko === "true");
    }

    if (kds !== undefined && kds !== "") {
      query.andWhere("kds", kds === "true");
    }

    if (llamador !== undefined && llamador !== "") {
      query.andWhere("llamador", llamador === "true");
    }

    const data = await query;
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error obteniendo connections" });
  }
});

// GET DETALLE LOCAL

router.get("/detalle/:id",  async (req, res) => {

  try {

    const { id } = req.params;

    const local = await mgmtDb("connections as c")

      // 🔥 usuario zonal
      .leftJoin("users as u", "u.id", "c.zonal")
      .select(
        "c.id",
        "c.name",
        "c.host",
        "c.codLocal",
        "c.rut",
        "c.razon_social",
        "c.kiosko",
        "c.ck",
        "c.kds",
        "c.c_kds",
        "c.llamador",
        "c.c_llamador",
        "c.activo",
        "c.created_at",
        // 🔥 zonal
        "u.id as zonal_id",
        "u.full_name as zonal_nombre",
        "u.email as zonal_email",
        "c.rut as rut",
        "c.razon_social as razon_social",
        "c.empresa_id"
      )
      .where("c.id", id)
      .first();

    if (!local) {
      return res.status(404).json({
        error: "Local no encontrado"
      });
    }

    res.json(local);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error obteniendo detalle"
    });
  }
});

// ✅ Crear conexión
router.post("/",  async (req, res) => {
  try {
    const payload = normalizarBody(req.body);

    const [row] = await mgmtDb("connections")
      .insert(payload)
      .returning("*");

    res.status(201).json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando registro" });
  }
});

// ✅ Editar conexión
router.put("/:id", async (req, res) => {
  try {
    const payload = normalizarBody(req.body);

    const [row] = await mgmtDb("connections")
      .where({ id: req.params.id })
      .update(payload)
      .returning("*");

    res.json(row);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error actualizando registro" });
  }
});

// ✅ Obtener detalle
router.get("/:id", async (req, res) => {
  try {
    const conn = await mgmtDb("connections").where({ id: req.params.id }).first();
    if (!conn) return res.status(404).json({ error: "no existe" });
    delete conn.password_enc;
    res.json(conn);
  } catch {
    res.status(500).json({ error: "Error al obtener conexión" });
  }
});

router.patch("/estado/:id", async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  const user = req.user;

  if (typeof activo !== "boolean") {
    return res.status(400).json({ error: "activo debe ser boolean" });
  }

  await mgmtDb("connections").where({ id }).update({ activo });

  /*await logMenuChange({
    entidad: "connection",
    entidadId: id,
    campo: "UDTATE_ACTIVO",
    valorAnterior: activo ? false : true,
    valorNuevo: activo,
    usuario: user.username,
    rol: user.role,
  });*/

  res.json({ ok: true });
});

// ✅ Eliminar
router.delete("/:id",  async (req, res) => {
  try {
    await mgmtDb("connections").where({ id: req.params.id }).del();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar conexión" });
  }
});

/**
 * 🔹 Test de conexión a una BD externa (SQL Server)
 */
router.get("/test/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const connConfig = await getConnectionById(id);
    if (!connConfig) {
      return res.status(404).json({ success: false, message: "Conexión no encontrada en BD interna" });
    }

    // Combinamos datos fijos del .env con el host dinámico
    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      server: connConfig.host,
      options: {
        encrypt: false, // usar según configuración del servidor
        trustServerCertificate: true,
        connectTimeout: 5000, // 5 segundos de timeout
      },
    };

    //console.log(`🔍 Probando conexión con host: ${connConfig.host} (${connConfig.name})...`);

    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    await pool.close();

    res.json({
      success: true,
      message: `Conexión a (${connConfig.host}) OK ✅`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: `Error al conectar con la BD externa: ${err.message}`,
    });
  }
});

// 🔹 Buscar conexión por codLocal
router.get("/by-codlocal/:codLocal",  async (req, res) => {
  try {
    const { codLocal } = req.params;
    if (!codLocal) return res.status(400).json({ error: "Falta el código local" });

    const conn = await mgmtDb("connections")
      .where({ codLocal })
      .select("id", "name", "host", "codLocal")
      .first();

    if (!conn) return res.json(null); // devuelve null si no existe

    res.json(conn);
  } catch (err) {
    console.error("❌ Error al buscar conexión por codLocal:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});



// routes/zonales.js
router.post("/asignar-locales", async (req, res) => {
  const { userId, codLocales } = req.body;

  if (!userId || !Array.isArray(codLocales) || codLocales.length === 0) {
    return res.status(400).json({ message: 'Datos inválidos' });
  }
  

  try {
    await mgmtDb.transaction(async trx => {

      // desasignar todos los que tenía ese zonal
      await trx("connections").where("zonal", userId).update({ zonal: null });

      // asignar los seleccionados
      if (codLocales.length > 0) {
        await trx("connections").whereIn("codLocal", codLocales).update({ zonal: userId });
      }
    });
    res.json({ message: 'Locales asignados correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error asignando locales' });
  }
});


router.get("/:connectionId/vendedor/:rut", allowRoles("Admin", "N2"), async (req, res) => {
  const { connectionId, rut } = req.params;
  let pool;

  try {
    const connConfig = await getConnectionById(connectionId);

    if (!connConfig) {
      return res.status(404).json({
        success: false,
        message: "Conexión no encontrada en BD interna"
      });
    }

    const cuil = String(rut || "").trim().toUpperCase();

    if (!cuil) {
      return res.status(400).json({
        success: false,
        message: "Debe ingresar un RUT."
      });
    }

    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      server: connConfig.host,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000
      }
    };

    pool = new sql.ConnectionPool(config);
    await pool.connect();

    const result = await pool
      .request()
      .input("cuil", sql.VarChar(20), cuil)
      .query(`
        SELECT
          vendedor,
          nombre,
          puesto,
          cuil,
          debaja,
          inhab
        FROM vendedor
        WHERE UPPER(RTRIM(cuil)) = @cuil
      `);

    const vendedor = result.recordset?.[0];

    if (!vendedor) {
      return res.status(404).json({
        success: false,
        message: "El RUT no fue encontrado en el local seleccionado."
      });
    }

    return res.json({
      success: true,
      vendedor: Number(vendedor.vendedor),
      nombre: vendedor.nombre?.trim() || "",
      puesto: vendedor.puesto?.trim() || "",
      cuil: vendedor.cuil?.trim().toUpperCase() || "",
      debaja: Number(vendedor.debaja || 0),
      inhab: Number(vendedor.inhab || 0)
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Error al consultar vendedor: ${err.message}`
    });
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {}
    }
  }
});

router.put("/:connectionId/vendedor/:rut", allowRoles("Admin", "N2"), async (req, res) => {
  const { connectionId, rut } = req.params;
  const { vendedor, puesto, estado } = req.body;
  let pool;

  try {
    const connConfig = await getConnectionById(connectionId);

    if (!connConfig) {
      return res.status(404).json({
        success: false,
        message: "Conexión no encontrada en BD interna"
      });
    }

    const cuil = String(rut || "").trim().toUpperCase();
    const puestoNormalizado = String(puesto || "").trim().toUpperCase();
    const estadoNormalizado = String(estado || "").trim().toUpperCase();

    if (!cuil) {
      return res.status(400).json({
        success: false,
        message: "Debe indicar un RUT."
      });
    }

    if (!["CAJERO", "GERENTE"].includes(puestoNormalizado)) {
      return res.status(400).json({
        success: false,
        message: "El puesto seleccionado no es válido."
      });
    }

    if (!["ACTIVO", "INACTIVO"].includes(estadoNormalizado)) {
      return res.status(400).json({
        success: false,
        message: "El estado seleccionado no es válido."
      });
    }

    const config = {
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      server: connConfig.host,
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000
      }
    };

    pool = new sql.ConnectionPool(config);
    await pool.connect();

    const actual = await pool
      .request()
      .input("vendedor", sql.Int, Number(vendedor))
      .input("cuil", sql.VarChar(20), cuil)
      .query(`
        SELECT
          vendedor,
          nombre,
          puesto,
          cuil,
          debaja,
          inhab
        FROM vendedor
        WHERE vendedor = @vendedor
          AND UPPER(RTRIM(cuil)) = @cuil
      `);

    const registro = actual.recordset?.[0];

    if (!registro) {
      return res.status(404).json({
        success: false,
        message: "El vendedor ya no coincide con la información consultada."
      });
    }

    const debaja = estadoNormalizado === "ACTIVO" ? 0 : 1;
    const inhab = estadoNormalizado === "ACTIVO" ? 0 : 1;

    const result = await pool
      .request()
      .input("vendedor", sql.Int, Number(vendedor))
      .input("cuil", sql.VarChar(20), cuil)
      .input("puesto", sql.VarChar(30), puestoNormalizado)
      .input("debaja", sql.Int, debaja)
      .input("inhab", sql.Int, inhab)
      .query(` UPDATE vendedor SET
          puesto = @puesto,
          debaja = @debaja,
          inhab = @inhab
        WHERE vendedor = @vendedor
          AND UPPER(RTRIM(cuil)) = @cuil
      `);

    if (!result.rowsAffected?.[0]) {
      return res.status(409).json({
        success: false,
        message: "No se realizaron cambios en el vendedor."
      });
    }

    await mgmtDb("notificaciones").insert({
      titulo: "Modificación de vendedor",
      contenido: `RUT ${cuil} - Cambio Puesto a ${puestoNormalizado} - En Local ${connConfig.name}.`,
      leido: false,
      url: "vendedores",
      created_at: new Date()
    });

    return res.json({
      success: true,
      vendedor: Number(vendedor),
      cuil,
      nombre: registro.nombre?.trim() || "",
      puesto: puestoNormalizado,
      estado: estadoNormalizado,
      debaja,
      inhab,
      message: "Vendedor actualizado correctamente."
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Error al actualizar vendedor: ${err.message}`
    });
  } finally {
    if (pool) {
      try {
        await pool.close();
      } catch {}
    }
  }
});


/* HELPERS*/
function normalizarBody(body) {
  return {
    name: body.name?.trim(),
    host: body.host?.trim(),

    codLocal: body.codLocal ? Number(body.codLocal) : null,
    zonal: body.zonal ? Number(body.zonal) : null,

    kiosko: !!body.kiosko,
    ck: body.ck ? Number(body.ck) : null,

    kds: !!body.kds,
    c_kds: body.c_kds ? Number(body.c_kds) : null,

    llamador: !!body.llamador,
    c_llamador: body.c_llamador ? Number(body.c_llamador) : null,

    activo: body.activo === undefined ? true : !!body.activo,
    rut: body.rut ? body.rut.trim() : null,
    razon_social: body.razon_social ? body.razon_social.trim() : null,

    empresa_id: body.empresa_id  ? Number(body.empresa_id) : 2,
  };
}

export default router;
