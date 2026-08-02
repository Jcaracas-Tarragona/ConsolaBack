import sql from "mssql";
import dotenv from "dotenv";

dotenv.config();

const configBase = {
  user: process.env.CENTRAL_USER,
  password: process.env.CENTRAL_PASS,
  database: process.env.DB_NAME,
  
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },

  connectionTimeout: 50000,
  requestTimeout: 15000,

  options: {
    encrypt: false,
    trustServerCertificate: true
  }

};


let poolCentral;


/**
 * CONEXIÓN ACTUAL DE LA APLICACIÓN
 * QA
 */
export async function getCentralPool() {
  if (!poolCentral) {
    poolCentral = await new sql.ConnectionPool({
      ...configBase,
      server: process.env.CENTRAL_IP,
      port: Number(1433)

    }).connect();

  }

  return poolCentral;

}


/**
 * CONEXIONES RRHH MULTIEMPRESA
 */

const poolsRRHH = {};

export async function getSqlServerPool( empresa = "QA" ) {
  const configuraciones = {
    QA: {
      server: process.env.CENTRAL_IP,
      port: Number(1433)
    },
    EMPRESA1: {
      server: process.env.CENTRAL_PROD,
      port: Number(process.env.CENTRAL_PORT)
    },
    EMPRESA2: {
      server: process.env.BD_ELEPS,
      port: Number(process.env.CENTRAL_PORT)
    }
  };

  const key = empresa.toUpperCase();
  const config = configuraciones[key];

  if (!config) {
    throw new Error(`Empresa SQL no configurada: ${empresa}`);
  }

  if (!poolsRRHH[key]) {
    poolsRRHH[key] =
      await new sql.ConnectionPool({
        ...configBase,
        server: config.server,
        port: config.port
      }).connect();
  }


  return poolsRRHH[key];

}