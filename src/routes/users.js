// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import mgmtDb from "../db/adminDb.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = express.Router();

// solo Admin puede administrar usuarios
//router.use(requireAuth);
router.use(requireRole("Admin"));

// Listar usuarios (sin password_hash)
router.get("/", async (req, res) => {
  try {
    const users = await mgmtDb("users").select("id", "username", "full_name", "email", "role", "created_at");
    res.json({ success: true, data: users });
    
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al listar usuarios" });
  }
}); 

// Detalle
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const user = await mgmtDb("users").select("id","username","full_name","email","role","created_at").where({ id }).first();
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener usuario" });
  }
});

// Crear usuario (Admin)
router.post("/", async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ success: false, message: "Campos requeridos" });
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    const [user] = await mgmtDb("users").insert({
      username,
      password_hash: hash,
      full_name,
      email,
      role
    }).returning(["id","username","full_name","email","role","created_at"]);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(400).json({ success: false, message: "Username ya existe" });
    res.status(500).json({ success: false, message: "Error al crear usuario" });
  }
});

// Actualizar usuario (Admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, full_name, email, role } = req.body;
    const update = { username, full_name, email, role };
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      update.password_hash = hash;
    }
    await mgmtDb("users").where({ id }).update(update);
    res.json({ success: true, message: "Usuario actualizado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al actualizar usuario" });
  }
});

// Eliminar usuario (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await mgmtDb("users").where({ id }).del();
    res.json({ success: true, message: "Usuario eliminado" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al eliminar usuario" });
  }
});

// Obtener locales sin zonal asignado
router.get("/sinzonal", async (req, res) => {
  console.log("consultando...");
  
  try {
    const result = await mgmtDb("connections")
      .select("codLocal", "name")
      .whereNull("zonal");
    log("Locales sin zonal:", result);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error obteniendo locales' });
  }
});


export default router;
