// src/auth.js
import express from "express";
import mgmtDb from "./db/adminDb.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/register", async (req, res) => {
  const { username, password, full_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: "username y password obligatorios" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [user] = await mgmtDb("users").insert({ username, password_hash: hash, full_name }).returning(["id","username","full_name"]);
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await mgmtDb("users").where({ username }).first();
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  const token = jwt.sign({ id: user.id, username: user.username,role:user.role }, JWT_SECRET, { expiresIn: "4h" });
  
  res.json({ token ,user});
});

// middleware para rutas protegidas
export function authenticateMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "no token" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "invalid token" });
  }
}

export default router;
