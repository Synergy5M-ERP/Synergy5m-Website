// db.js
const sql = require("mssql");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectionString = process.env.DB_CONNECTION_STRING;

// Quick non-blocking pool handler
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