// db.js
const sql = require("mssql");
const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// 1. Resolve connection string from process.env or GoDaddy's /alloc/config.json
let connectionString = process.env.DB_CONNECTION_STRING;

if (!connectionString) {
  const allocConfigPath = "/alloc/config.json";
  if (fs.existsSync(allocConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(allocConfigPath, "utf8"));
      connectionString =
        config.DB_CONNECTION_STRING ||
        config.connectionString ||
        config.db?.connectionString;
    } catch (e) {
      console.warn("Could not parse /alloc/config.json:", e.message);
    }
  }
}

// 2. Initialize connection
const poolPromise = (async () => {
  if (!connectionString) {
    console.error("==================================================");
    console.error("❌ CRITICAL: DB_CONNECTION_STRING is missing in environment variables!");
    console.error("==================================================");
    return null;
  }

  try {
    const pool = await sql.connect(connectionString);
    console.log("✅ Successfully connected to Azure SQL Database via Connection String.");
    return pool;
  } catch (err) {
    console.error("==================== AZURE SQL ERROR TRACE ====================");
    console.error("❌ Error Name:    ", err.name);
    console.error("❌ Error Code:    ", err.code || "N/A");
    console.error("❌ Error Message: ", err.message);

    if (err.originalError) {
      console.error("🔍 Driver Error:   ", err.originalError.message);
      console.error("🔍 Driver Code:    ", err.originalError.code || "N/A");

      if (err.originalError.info) {
        console.error("🔍 SQL Server ErrNo: ", err.originalError.info.number);
        console.error("🔍 SQL State:        ", err.originalError.info.state);
      }
    }
    console.error("===============================================================");
    return null;
  }
})();

module.exports = {
  sql,
  poolPromise,
};