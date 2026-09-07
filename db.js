// db.js
const sql = require("mssql");
const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, ".env") });

// 1. Resolve connection string from process.env, Azure App Service defaults, or /alloc/config.json
let connectionString =
  process.env.DB_CONNECTION_STRING ||
  process.env.SQLAZURECONNSTR_defaultConnection ||
  process.env.SQLAZURECONNSTR_DB_CONNECTION_STRING ||
  process.env.CUSTOMCONNSTR_DB_CONNECTION_STRING;

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
    console.warn("==================================================");
    console.warn("⚠️ NOTICE: DB_CONNECTION_STRING is missing in environment variables.");
    console.warn("⚠️ Server will continue running in UI-Only / Fallback mode.");
    console.warn("==================================================");
    return null;
  }

  try {
    const pool = await sql.connect(connectionString);
    console.log("✅ Successfully connected to Azure SQL Database via Connection String.");
    return pool;
  } catch (err) {
    console.warn("==================== AZURE SQL WARNING ====================");
    console.warn("⚠️ Database connection failed. Running in UI-Only mode.");
    console.warn("⚠️ Message:", err.message);

    if (err.originalError) {
      console.warn("🔍 Driver Error:", err.originalError.message);
    }
    console.warn("===========================================================");
    return null;
  }
})();

module.exports = {
  sql,
  poolPromise,
};