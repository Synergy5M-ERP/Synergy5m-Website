// db.js
const sql = require("mssql");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectionString = process.env.DB_CONNECTION_STRING;


require("dotenv").config({ path: path.join(__dirname, ".env") });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10) || 443,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 60000,
    requestTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};


const poolPromise = connectionString
  ? sql
      .connect(connectionString)
      .then((pool) => {
        console.log("✅ Connected to Azure SQL Server.");
        return pool;
      })
      .catch((err) => {
        console.warn("⚠️ Azure SQL unavailable over host port. Using fallback storage.");
        return null; // Return null so server continues running without throwing errors
      })
  : Promise.resolve(null);

module.exports = {
  sql,
  poolPromise,
};