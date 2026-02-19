import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const config = {
  user: process.env.CENTRAL_USER,
  password: process.env.CENTRAL_PASS,
  server: process.env.CENTRAL_IP,
  database: process.env.DB_NAME,
  port: Number(1433),

  options: {
    encrypt: false,
    trustServerCertificate: true,
  },

  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },

  connectionTimeout: 5000,
  requestTimeout: 15000,
};

let pool = null;

export async function getCentralPool() {
  if (pool?.connected) return pool;

  try {
    pool = await new sql.ConnectionPool(config).connect();
    console.log("✅ Conectado a BD Central");
    return pool;
  } catch (error) {
    pool = null;
    console.error("❌ Error BD Central:", error.message);
    throw error;
  }
}
