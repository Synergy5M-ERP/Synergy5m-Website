// db.js
const sql = require("mssql");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectionString = process.env.DB_CONNECTION_STRING;

if (!connectionString) {
  console.warn("⚠️ Warning: DB_CONNECTION_STRING is not set in environment.");
}

const poolPromise = connectionString
  ? sql
      .connect(connectionString)
      .then((pool) => {
        console.log("✅ Connected to Azure SQL Server successfully.");
        return pool;
      })
      .catch((err) => {
        console.error("❌ SQL Server Connection Failed:", err.message);
        return null; // DO NOT call process.exit(1) here!
      })
  : Promise.resolve(null);

module.exports = {
  sql,
  poolPromise,
};