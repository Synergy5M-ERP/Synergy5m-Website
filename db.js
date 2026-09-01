const sql = require("mssql");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const connectionString = process.env.DB_CONNECTION_STRING;

if (!connectionString) {
  console.error("❌ Missing DB_CONNECTION_STRING in environment variables.");
  process.exit(1);
}

const poolPromise = sql
  .connect(connectionString)
  .then((pool) => {
    console.log("✅ Connected to Azure SQL Server via Connection String successfully.");
    return pool;
  })
  .catch((err) => {
    console.error("❌ SQL Server Connection Failed:", err.message);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise,
};