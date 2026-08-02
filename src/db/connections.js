// src/db/connections.js
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();

// Pool del sistema de gestión (PostgreSQL local)
const pool = new Pool({
  connectionString: process.env.MGMT_DB_URL,
});

// --- Obtener una conexión por ID ---
export async function getConnectionById(id) {
  try {
    const { rows } = await pool.query(
      `SELECT "id", "name", "host", "codLocal"
       FROM connections
       WHERE "id" = $1`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    console.error("Error al obtener conexión:", err.message);
    throw err;
  }
}

// ✅ Configuración dinámica MSSQL
export function makeMssqlConfig(host) {
  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: host, // viene de la BD connections.host
    database: process.env.DB_NAME,
    port: parseInt(process.env.MSSQL_PORT) || 1433,
    options: {
      encrypt: false, // true si usas Azure
      trustServerCertificate: true,
    },
    requestTimeout: 30000,
    connectionTimeout: 60000,
  };
}
