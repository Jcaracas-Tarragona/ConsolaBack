// knexfile.js
import dotenv from "dotenv";
dotenv.config();

export default {

  development: {
    client: "pg",
    connection: process.env.MGMT_DB_URL,
    migrations: {
      directory: "./src/db/migrations"
    }
  },

  production: {
    client: "pg",
    connection: process.env.MGMT_DB_URL,
    migrations: {
      directory: "./src/db/migrations"
    }
  }

};