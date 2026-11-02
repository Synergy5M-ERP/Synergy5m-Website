// auth.js - JWT Authentication & Authorization Middleware
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

// Ensure a strong secret key
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.ADMIN_PASSWORD
    ? crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD + (process.env.ADMIN_USER || "admin")).digest("hex")
    : crypto.randomBytes(32).toString("hex"));

if (!process.env.JWT_SECRET) {
  console.warn("⚠️ NOTICE: JWT_SECRET not defined in .env; please define a persistent JWT_SECRET in production.");
}

/**
 * Generate a signed JWT for Admin
 */
function generateAdminToken(user) {
  return jwt.sign(
    {
      username: user,
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

/**
 * Middleware to verify Admin JWT
 */
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    // Optional fallback for file downloads or event sources if needed
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Authentication token is missing.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired authentication session. Please log in again.",
    });
  }
}

module.exports = {
  JWT_SECRET,
  generateAdminToken,
  verifyAdminToken,
};
