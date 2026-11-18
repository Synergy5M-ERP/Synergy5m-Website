const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const axios = require("axios");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const { sql, poolPromise } = require("./db");
const { generateAdminToken, verifyAdminToken } = require("./auth");

const app = express();
app.disable("x-powered-by");

app.set("trust proxy", 1);

// Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Prevents blocking inline scripts/styles needed by React and Quill
  })
);

// CORS Whitelisting
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "https://synergy5m-business-4-profit-platform.azurewebsites.net",
  "https://synergy5m.com",
  "https://www.synergy5m.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. same-origin or local tools)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Rate Limiting Configurations
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 failed login attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again after 15 minutes." },
});

const publicFormLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 submissions per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down and try again shortly." },
});

// Email Transporter configuration with connection pooling & timeouts
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "development" ? false : true,
  },
});

// Non-blocking parallel background email dispatcher with batching & polite spacing
function dispatchEmailTasksInBackground(tasks) {
  if (!tasks || tasks.length === 0) return;
  (async () => {
    const BATCH_SIZE = 4;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(batch.map(async (task) => {
        try {
          await transporter.sendMail(task.mailOptions);
        } catch (err) {
          // Suppress sensitive SMTP/PII details from logs
        }
      }));
      if (i + BATCH_SIZE < tasks.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }
  })().catch(() => { });
}

// Resilient filesystem handling
let uploadDir = path.join(__dirname, "uploads");
let dataDir = path.join(__dirname, "data");

function initDirectories() {
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    const tempRoot = os.tmpdir();
    uploadDir = path.join(tempRoot, "uploads");
    dataDir = path.join(tempRoot, "data");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  }
}
initDirectories();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Sanitize filename to prevent directory traversal or malformed names
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const allowedMimes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx"];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext) || !allowedMimes.includes(file.mimetype)) {
      return cb(new Error("Invalid file format. Only PDF, standard images (JPG, PNG), Word, and Excel files are allowed."));
    }
    cb(null, true);
  },
});

// Serve uploads with security headers preventing HTML/script execution
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    next();
  },
  express.static(uploadDir)
);

function safeAppendJson(filename, payload) {
  try {
    const filePath = path.join(dataDir, filename);
    fs.appendFileSync(filePath, JSON.stringify(payload) + "\n", "utf8");
  } catch (err) {
    console.warn(`Local fallback write skipped (${filename}):`, err.message);
  }
}

// Helper: Generate Secure Random Password
const generatePassword = (length = 10) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return pwd;
};

// -------------------------------------------------------------
// Email duplicate-check helpers
// -------------------------------------------------------------
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

// Returns true if the email is already used in BusinessEnquiries
// (company email or representative email) or already has a user login.
// To allow rejected companies to re-apply, add:
//   AND ISNULL(Status, '') <> 'Rejected'
// to the BusinessEnquiries part of the query.
async function emailExistsInDb(pool, email) {
  const result = await pool
    .request()
    .input("Email", sql.NVarChar(150), email)
    .query(`
      SELECT TOP 1 1 AS Found
      FROM dbo.BusinessEnquiries
      WHERE LOWER(LTRIM(RTRIM(CompanyEmail))) = @Email
         OR LOWER(LTRIM(RTRIM(RepresentativeEmail))) = @Email
      UNION ALL
      SELECT TOP 1 1
      FROM dbo.TrialRequests
      WHERE LOWER(LTRIM(RTRIM(Email))) = @Email
      UNION ALL
      SELECT TOP 1 1
      FROM dbo.HRM_UserTbl
      WHERE LOWER(LTRIM(RTRIM(username))) = @Email
    `);
  return result.recordset.length > 0;
}

// -------------------------------------------------------------
// Diagnostics & Health Endpoints
// -------------------------------------------------------------

app.get("/api/health", async (req, res) => {
  try {
    const pool = await poolPromise;
    const dbStatus = pool ? "Connected" : "Disconnected";
    return res.status(200).json({
      status: "Healthy",
      environment: process.env.NODE_ENV || "production",
      database: dbStatus,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ status: "Degraded", error: err.message });
  }
});

// -------------------------------------------------------------
// Real-time email duplicate check  (used by the registration form)
// GET /api/check-email?email=abc@xyz.com  ->  { exists: true | false }
// -------------------------------------------------------------
app.get("/api/check-email", publicFormLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.json({ exists: false });

    const pool = await poolPromise;
    if (!pool) return res.json({ exists: false });

    const exists = await emailExistsInDb(pool, email);
    return res.json({ exists });
  } catch (err) {
    console.error("check-email error:", err.message);
    return res.status(500).json({ exists: false, error: "Check failed" });
  }
});

// -------------------------------------------------------------
// Dropdown Data Endpoints
// -------------------------------------------------------------

app.get("/api/categories", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json([]);
    }

    const result = await pool.request().query(`
      SELECT DISTINCT LTRIM(RTRIM([Category])) AS Category
      FROM [CollectiveProducts]
      WHERE [Category] IS NOT NULL AND LTRIM(RTRIM([Category])) <> ''
      ORDER BY Category ASC
    `);

    const categories = result.recordset.map((row) => row.Category).filter(Boolean);
    return res.json(categories);
  } catch (err) {
    console.warn("Categories fetch fallback:", err.message);
    return res.json([]);
  }
});

app.get("/api/potential-vendors/count", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ error: "Database connection not available" });
    }

    const result = await pool.request().query(`
      SELECT COUNT(*) AS TotalCount 
      FROM [dbo].[Potential_Vendor]
    `);

    const count = result.recordset[0]?.TotalCount || 0;
    return res.json({ count });
  } catch (err) {
    console.error("Potential vendors count fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch count" });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const { category } = req.query;
    const pool = await poolPromise;
    if (!pool) {
      return res.json([]);
    }

    const request = pool.request();
    let query = `
      SELECT DISTINCT LTRIM(RTRIM([ProductName])) AS Item_Name
      FROM [CollectiveProducts]
      WHERE [ProductName] IS NOT NULL 
        AND LTRIM(RTRIM([ProductName])) <> ''
    `;

    if (category && category !== "Other / Add New" && category !== "All") {
      request.input("category", sql.NVarChar, category.trim());
      query += ` AND UPPER(LTRIM(RTRIM(ISNULL([Category], '')))) = UPPER(@category)`;
    }

    query += ` ORDER BY Item_Name ASC`;

    const result = await request.query(query);
    return res.json(result.recordset.map((row) => row.Item_Name));
  } catch (err) {
    console.warn("Products fetch error:", err.message);
    return res.json([]);
  }
});

app.get("/api/units", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json(["Kg", "Meters", "MT", "Nos", "Pieces", "Bags", "Liters"]);
    }

    const result = await pool.request().query(`
      SELECT DISTINCT [Unit_Of_Measurement] 
      FROM [dbo].[UOMTbl] 
      WHERE [Unit_Of_Measurement] IS NOT NULL 
      ORDER BY [Unit_Of_Measurement] ASC
    `);

    return res.json(result.recordset.map((row) => row.Unit_Of_Measurement));
  } catch (err) {
    console.warn("Units fetch fallback:", err.message);
    return res.json(["Kg", "Meters", "MT", "Nos", "Pieces", "Bags"]);
  }
});

app.get("/api/currencies", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json(["INR", "USD", "EUR", "AED", "GBP"]);
    }

    const result = await pool.request().query(`
      SELECT DISTINCT [Currency_Code] 
      FROM [dbo].[Currencytbl] 
      WHERE [Currency_Code] IS NOT NULL 
      ORDER BY [Currency_Code] ASC
    `);

    return res.json(result.recordset.map((row) => row.Currency_Code));
  } catch (err) {
    console.warn("Currencies fetch fallback:", err.message);
    return res.json(["INR", "USD", "EUR", "AED"]);
  }
});

app.get("/api/industries", async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json([
        "Automotive",
        "Chemicals",
        "Engineering",
        "Manufacturing",
        "Packaging",
        "Pharmaceuticals",
        "Plastics & Polymers",
        "Textiles",
      ]);
    }

    const result = await pool.request().query(`
      SELECT DISTINCT [IndustryName] 
      FROM [dbo].[Industry] 
      WHERE [IndustryName] IS NOT NULL 
      ORDER BY [IndustryName] ASC
    `);

    return res.json(result.recordset.map((row) => row.IndustryName));
  } catch (err) {
    console.warn("Industries fetch fallback:", err.message);
    return res.json(["Manufacturing", "Automotive", "Chemicals", "Engineering", "Packaging"]);
  }
});

// -------------------------------------------------------------
// Form Handlers
// -------------------------------------------------------------

app.post("/api/inquiries", publicFormLimiter, async (req, res) => {
  try {
    const {
      fullName,
      businessEmail,
      companyName,
      officialMobile,
      interestedIn,
      requirement,
    } = req.body;

    const pool = await poolPromise;

    if (pool) {
      await pool
        .request()
        .input("FullName", sql.NVarChar(150), String(fullName || "").trim())
        .input("BusinessEmail", sql.NVarChar(150), String(businessEmail || "").trim())
        .input("CompanyName", sql.NVarChar(200), String(companyName || "").trim())
        .input("OfficialMobile", sql.NVarChar(50), String(officialMobile || "").trim())
        .input("InterestedIn", sql.NVarChar(100), String(interestedIn || "General Inquiry").trim())
        .input("Requirement", sql.NVarChar(sql.MAX), requirement ? String(requirement).trim() : null)
        .query(`
          INSERT INTO dbo.Inquiries (FullName, BusinessEmail, CompanyName, OfficialMobile, InterestedIn, Requirement)
          VALUES (@FullName, @BusinessEmail, @CompanyName, @OfficialMobile, @InterestedIn, @Requirement)
        `);
    } else {
      safeAppendJson("inquiries.jsonl", { ...req.body, submittedAt: new Date().toISOString() });
    }

    return res.status(201).json({
      success: true,
      message: "Your inquiry has been submitted successfully.",
    });
  } catch (error) {
    console.error("Error saving inquiry:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

const uploadFields = upload.fields([
  { name: "attachment", maxCount: 1 },
  { name: "documents", maxCount: 10 },
]);

app.post("/api/business-connect", publicFormLimiter, uploadFields, async (req, res) => {
  try {
    const d = req.body;

    // Normalize category to "Seller", "Both", or default to "Buyer"
    const rawCategory = (d.category || "").trim().toLowerCase();
    let category = "Buyer";
    let prefix = "B";

    if (rawCategory === "seller") {
      category = "Seller";
      prefix = "S";
    } else if (rawCategory === "both") {
      category = "Both";
      prefix = "BS"; // Code will generate as BS00001, BS00002...
    }

    let attachmentPaths = [];
    if (req.files) {
      if (req.files.attachment) {
        attachmentPaths.push(...req.files.attachment.map((f) => `/uploads/${f.filename}`));
      }
      if (req.files.documents) {
        attachmentPaths.push(...req.files.documents.map((f) => `/uploads/${f.filename}`));
      }
    }
    const finalAttachment = attachmentPaths.length > 0 ? attachmentPaths.join(";") : null;
    const priceOrRange = d.expectedPriceRange || d.targetPrice || d.indicativePrice || null;
    const paymentTerms = d.paymentTermsExpected || d.paymentTerms || null;

    const pool = await poolPromise;

    if (pool) {
      // ---------------- Duplicate email guard (do NOT save if exists) ----------------
      const companyEmailNorm = normalizeEmail(d.companyEmail);
      const repEmailNorm = normalizeEmail(d.representativeEmail);

      if (companyEmailNorm && (await emailExistsInDb(pool, companyEmailNorm))) {
        return res.status(409).json({
          success: false,
          message: "Company Email already exists. Please use a different email.",
        });
      }
      if (repEmailNorm && (await emailExistsInDb(pool, repEmailNorm))) {
        return res.status(409).json({
          success: false,
          message: "Representative Email already exists. Please use a different email.",
        });
      }
      // -------------------------------------------------------------------------------

      const prefixLen = prefix.length;
      const query = `
        DECLARE @NextId INT;
        DECLARE @NextNum INT;
        DECLARE @Prefix NVARCHAR(10) = '${prefix}';
        DECLARE @PrefixLen INT = ${prefixLen};
        DECLARE @PrefixPattern NVARCHAR(20) = @Prefix + '%';

        -- Generate Next Integer ID
        SELECT @NextId = ISNULL(MAX(Id), 0) + 1
        FROM dbo.BusinessEnquiries WITH (TABLOCKX, HOLDLOCK);

        -- Generate Next Prefix Number dynamically using prefix length
        SELECT @NextNum = ISNULL(MAX(CAST(SUBSTRING(Code, @PrefixLen + 1, LEN(Code)) AS INT)), 0) + 1
        FROM dbo.BusinessEnquiries WITH (TABLOCKX, HOLDLOCK)
        WHERE Code LIKE @PrefixPattern
          AND ISNUMERIC(SUBSTRING(Code, @PrefixLen + 1, LEN(Code))) = 1;

        DECLARE @GeneratedCode NVARCHAR(50) = @Prefix + RIGHT('00000' + CAST(@NextNum AS NVARCHAR(10)), 5);

        INSERT INTO dbo.BusinessEnquiries (
          Id, Code, Category,
          CompanyName, GSTIN, CIN, Address, Website, CompanyEmail, Mobile, Industry, CompanyType, YearsInBusiness,
          RepresentativeName, Role, RepresentativeEmail, RepresentativeMobile,
          ProductName, ProductCategory, GradeModel, Application, TechnicalSpecification, HSNCode,
          RequiredQuantity, Unit, RequirementFrequency, DeliveryLocation, RequiredDeliveryDate,
          ManufacturerSupplier, ProductionCapacity, MOQ, LeadTime,
          PriceOrRange, Currency, PaymentTerms,
          CommissionType, ProposedCommission, CommissionApplicableOn,
          AttachmentPath, CreatedAt
        ) 
        OUTPUT INSERTED.Id, INSERTED.Code
        VALUES (
          @NextId, @GeneratedCode, @Category,
          @CompanyName, @GSTIN, @CIN, @Address, @Website, @CompanyEmail, @Mobile, @Industry, @CompanyType, @YearsInBusiness,
          @RepresentativeName, @Role, @RepresentativeEmail, @RepresentativeMobile,
          @ProductName, @ProductCategory, @GradeModel, @Application, @TechnicalSpecification, @HSNCode,
          @RequiredQuantity, @Unit, @RequirementFrequency, @DeliveryLocation, @RequiredDeliveryDate,
          @ManufacturerSupplier, @ProductionCapacity, @MOQ, @LeadTime,
          @PriceOrRange, @Currency, @PaymentTerms,
          @CommissionType, @ProposedCommission, @CommissionApplicableOn,
          @AttachmentPath, GETDATE()
        );
      `;

      const result = await pool
        .request()
        .input("Category", sql.NVarChar(20), category)
        .input("CompanyName", sql.NVarChar(250), (d.companyName || "").trim())
        .input("GSTIN", sql.NVarChar(15), (d.gstin || "").trim())
        .input("CIN", sql.NVarChar(50), (d.cin || "").trim())
        .input("Address", sql.NVarChar(sql.MAX), (d.address || "").trim())
        .input("Website", sql.NVarChar(255), d.website ? d.website.trim() : null)
        .input("CompanyEmail", sql.NVarChar(150), (d.companyEmail || "").trim())
        .input("Mobile", sql.NVarChar(20), (d.mobile || "").trim())
        .input("Industry", sql.NVarChar(150), (d.industry || "").trim())
        .input("CompanyType", sql.NVarChar(100), (d.companyType || "").trim())
        .input("YearsInBusiness", sql.NVarChar(50), d.years || d.sellerYearsInBusiness || null)
        .input("RepresentativeName", sql.NVarChar(150), (d.representativeName || "").trim())
        .input("Role", sql.NVarChar(100), (d.role || "").trim())
        .input("RepresentativeEmail", sql.NVarChar(150), (d.representativeEmail || "").trim())
        .input("RepresentativeMobile", sql.NVarChar(20), (d.representativeMobile || "").trim())
        .input("ProductName", sql.NVarChar(250), (d.productName || "").trim())
        .input("ProductCategory", sql.NVarChar(150), (d.productCategory || "").trim())
        .input("GradeModel", sql.NVarChar(150), d.gradeModel || null)
        .input("Application", sql.NVarChar(sql.MAX), d.application || null)
        .input("TechnicalSpecification", sql.NVarChar(sql.MAX), d.technicalSpecification || null)
        .input("HSNCode", sql.NVarChar(50), d.hsnCode || null)
        .input("RequiredQuantity", sql.NVarChar(100), d.requiredQuantity || null)
        .input("Unit", sql.NVarChar(50), d.unit || null)
        .input("RequirementFrequency", sql.NVarChar(100), d.requirementFrequency || null)
        .input("DeliveryLocation", sql.NVarChar(255), d.deliveryLocation || null)
        .input("RequiredDeliveryDate", sql.DateTime, d.requiredDeliveryDate ? new Date(d.requiredDeliveryDate) : null)
        .input("ManufacturerSupplier", sql.NVarChar(250), d.manufacturerSupplier || null)
        .input("ProductionCapacity", sql.NVarChar(100), d.productionCapacity || d.capacity || d.monthlyCapacity || null)
        .input("MOQ", sql.NVarChar(100), d.moq || null)
        .input("LeadTime", sql.NVarChar(100), d.leadTime || null)
        .input("PriceOrRange", sql.NVarChar(100), priceOrRange)
        .input("Currency", sql.NVarChar(20), d.currency || null)
        .input("PaymentTerms", sql.NVarChar(200), paymentTerms)
        .input("CommissionType", sql.NVarChar(100), d.commissionType || null)
        .input("ProposedCommission", sql.NVarChar(100), d.proposedCommission || null)
        .input("CommissionApplicableOn", sql.NVarChar(150), d.commissionApplicableOn || null)
        .input("AttachmentPath", sql.NVarChar(sql.MAX), finalAttachment)
        .query(query);

      const record = result.recordset[0];
      return res.status(201).json({
        success: true,
        id: record.Id,
        code: record.Code,
        message: `Submitted successfully under Reference Code: ${record.Code}`,
      });
    }

    const generatedCode = `${prefix}-${Date.now().toString().slice(-5)}`;
    safeAppendJson("business_enquiries.jsonl", { ...d, category, code: generatedCode, submittedAt: new Date().toISOString() });

    return res.status(201).json({
      success: true,
      id: Date.now(),
      code: generatedCode,
      message: `Submitted successfully (Ref: ${generatedCode})`,
    });
  } catch (error) {
    // 2601 / 2627 = unique index / unique constraint violation in SQL Server
    if (error && (error.number === 2601 || error.number === 2627)) {
      return res.status(409).json({
        success: false,
        message: "This email already exists. Please use a different email.",
      });
    }
    console.error("Error saving BusinessEnquiry:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/demo-request", publicFormLimiter, async (req, res) => {
  try {
    const {
      fullName,
      businessEmail,
      companyName,
      officialMobile,
      preferredDate,
      timeSlot,
      meetingPlatform,
      requirement,
    } = req.body;

    if (
      !fullName ||
      !businessEmail ||
      !companyName ||
      !officialMobile ||
      !preferredDate ||
      !timeSlot ||
      !meetingPlatform
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all mandatory scheduling fields.",
      });
    }

    const pool = await poolPromise;
    let insertedId = null;
    let dbSaved = false;

    if (pool) {
      try {
        const query = `
          DECLARE @NextId INT;
          SELECT @NextId = ISNULL(MAX(Id), 0) + 1 
          FROM dbo.DemoRequests WITH (TABLOCKX, HOLDLOCK);

          INSERT INTO dbo.DemoRequests (
            Id, FullName, BusinessEmail, CompanyName, OfficialMobile,
            PreferredDate, TimeSlot, MeetingPlatform, Requirement,
            DemoStatus, CreatedAt
          )
          OUTPUT INSERTED.Id
          VALUES (
            @NextId, @FullName, @BusinessEmail, @CompanyName, @OfficialMobile,
            @PreferredDate, @TimeSlot, @MeetingPlatform, @Requirement,
            'Pending', GETUTCDATE()
          );
        `;

        const result = await pool
          .request()
          .input("FullName", sql.NVarChar(150), String(fullName).trim())
          .input("BusinessEmail", sql.NVarChar(255), String(businessEmail).trim().toLowerCase())
          .input("CompanyName", sql.NVarChar(200), String(companyName).trim())
          .input("OfficialMobile", sql.NVarChar(20), String(officialMobile).trim())
          .input("PreferredDate", sql.Date, new Date(preferredDate))
          .input("TimeSlot", sql.NVarChar(50), String(timeSlot).trim())
          .input("MeetingPlatform", sql.NVarChar(50), String(meetingPlatform).trim())
          .input("Requirement", sql.NVarChar(sql.MAX), requirement ? String(requirement).trim() : null)
          .query(query);

        insertedId = result.recordset[0]?.Id;
        dbSaved = true;
      } catch (dbErr) {
        console.warn("DB insert failed for DemoRequest, saving to local fallback:", dbErr.message);
      }
    }

    if (!dbSaved) {
      safeAppendJson("demo_requests.jsonl", { ...req.body, submittedAt: new Date().toISOString() });
    }

    const mailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #0b5ed7;">New SYN ERP 10 Demo Request</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; border-color: #ddd;">
          <tr><td><strong>Client Name</strong></td><td>${fullName}</td></tr>
          <tr><td><strong>Company Name</strong></td><td>${companyName}</td></tr>
          <tr><td><strong>Business Email</strong></td><td>${businessEmail}</td></tr>
          <tr><td><strong>Official Mobile</strong></td><td>${officialMobile}</td></tr>
          <tr><td><strong>Preferred Date</strong></td><td>${new Date(preferredDate).toLocaleDateString()}</td></tr>
          <tr><td><strong>Time Slot</strong></td><td><strong>${timeSlot}</strong></td></tr>
          <tr><td><strong>Meeting Platform</strong></td><td><strong>${meetingPlatform}</strong></td></tr>
          <tr><td><strong>Requirements / Notes</strong></td><td>${requirement || "None specified"}</td></tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Synergy5M ERP System" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
        to: ["sales@synergy5m.com", "accounts@synergy5m.com"],
        subject: `SYN ERP 10 Demo Request: ${companyName}`,
        html: mailHtml,
      });
    } catch (mailErr) {
      console.warn("Mail sending bypassed:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      id: insertedId,
      message: "Your demo request has been submitted successfully!",
    });
  } catch (error) {
    console.error("Error processing DemoRequest:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/trial-request", publicFormLimiter, async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      mobileNo,
      email,
      address,
      gstNo,
      numberOfUsers,
      subscriptionPlan,
      trialStartDate,
      trialEndDate,
      trialStatus,
      remarks,
    } = req.body;

    if (!companyName || !contactPerson || !mobileNo || !email || !subscriptionPlan || !trialStartDate) {
      return res.status(400).json({
        success: false,
        message: "Please fill all mandatory fields marked with *",
      });
    }

    const calculatedStatus = trialStatus || "Pending";
    let dbSaved = false;

    const pool = await poolPromise;

    // ---------------- Duplicate email guard (do NOT save if exists) ----------------
    // Kept outside the try/catch below so a duplicate is never silently
    // written to the local fallback file.
    if (pool) {
      const trialEmailNorm = normalizeEmail(email);
      if (trialEmailNorm && (await emailExistsInDb(pool, trialEmailNorm))) {
        return res.status(409).json({
          success: false,
          message: "This email already exists. Please use a different email.",
        });
      }
    }
    // -------------------------------------------------------------------------------

    if (pool) {
      try {
        const query = `
          DECLARE @NextId INT;
          SELECT @NextId = ISNULL(MAX(Id), 0) + 1 
          FROM dbo.TrialRequests WITH (TABLOCKX, HOLDLOCK);

          INSERT INTO dbo.TrialRequests (
            Id, CompanyName, ContactPerson, MobileNo, Email,
            Address, GstNo, NumberOfUsers, SubscriptionPlan,
            TrialStartDate, TrialEndDate, TrialStatus, Remarks,
            CreatedAt
          )
          VALUES (
            @NextId, @CompanyName, @ContactPerson, @MobileNo, @Email,
            @Address, @GstNo, @NumberOfUsers, @SubscriptionPlan,
            @TrialStartDate, @TrialEndDate, @TrialStatus, @Remarks,
            GETDATE()
          );
        `;

        await pool
          .request()
          .input("CompanyName", sql.NVarChar(250), companyName.trim())
          .input("ContactPerson", sql.NVarChar(150), contactPerson.trim())
          .input("MobileNo", sql.NVarChar(20), mobileNo.trim())
          .input("Email", sql.NVarChar(150), email.trim().toLowerCase())
          .input("Address", sql.NVarChar(sql.MAX), address ? address.trim() : null)
          .input("GstNo", sql.NVarChar(20), gstNo ? gstNo.trim() : null)
          .input("NumberOfUsers", sql.Int, numberOfUsers ? parseInt(numberOfUsers, 10) : null)
          .input("SubscriptionPlan", sql.NVarChar(50), subscriptionPlan)
          .input("TrialStartDate", sql.Date, new Date(trialStartDate))
          .input("TrialEndDate", sql.Date, trialEndDate ? new Date(trialEndDate) : null)
          .input("TrialStatus", sql.NVarChar(50), calculatedStatus)
          .input("Remarks", sql.NVarChar(sql.MAX), remarks ? remarks.trim() : null)
          .query(query);

        dbSaved = true;
      } catch (dbErr) {
        console.warn("DB insert failed, writing to fallback storage:", dbErr.message);
      }
    }

    if (!dbSaved) {
      safeAppendJson("trial_requests.jsonl", { ...req.body, submittedAt: new Date().toISOString() });
    }

    const mailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #0b5ed7;">New SYN ERP 10 Trial Request</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; border-color: #ddd;">
          <tr><td><strong>Company Name</strong></td><td>${companyName}</td></tr>
          <tr><td><strong>Contact Person</strong></td><td>${contactPerson}</td></tr>
          <tr><td><strong>Mobile No.</strong></td><td>${mobileNo}</td></tr>
          <tr><td><strong>Email</strong></td><td>${email}</td></tr>
          <tr><td><strong>Subscription Plan</strong></td><td><strong>${subscriptionPlan}</strong></td></tr>
          <tr><td><strong>Trial Dates</strong></td><td>${trialStartDate} to ${trialEndDate || "Open"}</td></tr>
          <tr><td><strong>Status</strong></td><td>${calculatedStatus}</td></tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Synergy5M ERP System" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
        to: ["sales@synergy5m.com", "accounts@synergy5m.com"],
        cc: ["sales@synergy5m.com", "accounts@synergy5m.com"],
        subject: `New SYN ERP Trial Request: ${companyName}`,
        html: mailHtml,
      });
    } catch (mailErr) {
      console.warn("Mail sending bypassed:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Trial request submitted successfully!",
    });
  } catch (error) {
    console.error("Submission processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error processing trial request.",
    });
  }
});

// -------------------------------------------------------------
// Admin Endpoints (Directly Mounted on app)
// -------------------------------------------------------------

// 1. Admin Login (With JWT & Rate Limiting)
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};

  const inputUser = (username || "").trim();
  const inputPass = (password || "").trim();
  const adminUser = (process.env.ADMIN_USER || "admin").trim();
  const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();

  if (inputUser === adminUser && inputPass === adminPass) {
    const token = generateAdminToken(adminUser);
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: adminUser,
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials",
  });
});

// 2. Fetch Paginated Data for ERP or Buying/Selling
app.get("/api/admin/enquiries", verifyAdminToken, async (req, res) => {
  const type = req.query.type; // 'erp' or 'buyingselling'
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const search = (req.query.search || "").trim();
  const statusFilter = (req.query.status || "").trim();
  const offset = (page - 1) * limit;

  try {
    const pool = await poolPromise;
    let query = "";
    const request = pool.request();
    request.input("Offset", offset);
    request.input("Limit", limit);

    if (type === "erp") {
      let whereClauses = ["1=1"];
      if (search) {
        request.input("SearchTerm", `%${search}%`);
        whereClauses.push(
          "(CompanyName LIKE @SearchTerm OR ContactPerson LIKE @SearchTerm OR Email LIKE @SearchTerm OR MobileNo LIKE @SearchTerm OR GstNo LIKE @SearchTerm)"
        );
      }

      // Handle Status Filtering for ERP
      if (statusFilter && statusFilter !== "All") {
        if (statusFilter === "Pending" || statusFilter === "Pending Verification") {
          whereClauses.push("(TrialStatus IS NULL OR TrialStatus = '' OR TrialStatus IN ('Pending', 'Pending Verification', 'Active'))");
        } else {
          request.input("StatusFilter", statusFilter);
          whereClauses.push("TrialStatus = @StatusFilter");
        }
      }

      query = `
        SELECT 
          Id, CompanyName, ContactPerson, MobileNo, Email,
          Address, GstNo, NumberOfUsers, SubscriptionPlan,
          TrialStartDate, TrialEndDate, TrialStatus, Remarks, CreatedAt,
          COUNT(*) OVER() AS TotalCount
        FROM [dbo].[TrialRequests]
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY Id DESC
        OFFSET @Offset ROWS
        FETCH NEXT @Limit ROWS ONLY;
      `;
    } else if (type === "buyingselling") {
      let whereClauses = ["1=1"];
      if (search) {
        request.input("SearchTerm", `%${search}%`);
        whereClauses.push(
          "(CompanyName LIKE @SearchTerm OR RepresentativeName LIKE @SearchTerm OR CompanyEmail LIKE @SearchTerm OR RepresentativeEmail LIKE @SearchTerm OR Mobile LIKE @SearchTerm OR GSTIN LIKE @SearchTerm OR Code LIKE @SearchTerm)"
        );
      }

      // Handle Status Filtering for Buying/Selling
      if (statusFilter && statusFilter !== "All") {
        if (statusFilter === "Pending" || statusFilter === "Pending Verification") {
          whereClauses.push("(Status IS NULL OR Status = '' OR Status IN ('Pending', 'Pending Verification', 'Active'))");
        } else {
          request.input("StatusFilter", statusFilter);
          whereClauses.push("Status = @StatusFilter");
        }
      }

      query = `
        SELECT 
          Id, Code, Category, CompanyName, GSTIN, CIN, Address,
          Website, CompanyEmail, Mobile, Industry, CompanyType,
          YearsInBusiness, RepresentativeName, Role, RepresentativeEmail,
          RepresentativeMobile, ProductName, ProductCategory, GradeModel,
          Application, TechnicalSpecification, HSNCode, RequiredQuantity,
          Unit, RequirementFrequency, DeliveryLocation, RequiredDeliveryDate,
          ManufacturerSupplier, ProductionCapacity, MOQ, LeadTime,
          PriceOrRange, Currency, PaymentTerms, CommissionType,
          ProposedCommission, CommissionApplicableOn, AttachmentPath,
          CreatedAt, TargetPrice, IndicativePrice, ExpectedPriceRange,
          PaymentTermsExpected, MonthlyCapacity, DocumentsPath, Status, UpdatedAt,
          COUNT(*) OVER() AS TotalCount
        FROM [dbo].[BusinessEnquiries]
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY Id DESC
        OFFSET @Offset ROWS
        FETCH NEXT @Limit ROWS ONLY;
      `;
    } else {
      return res.status(400).json({ success: false, message: "Invalid type requested" });
    }

    const result = await request.query(query);
    const totalRecords = result.recordset.length > 0 ? result.recordset[0].TotalCount : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return res.json({
      success: true,
      data: result.recordset,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (err) {
    console.error("Fetch records error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/approve", verifyAdminToken, async (req, res) => {
  const { id, type, email, recipientName } = req.body;
  if (!id || !type || !email) {
    return res.status(400).json({ success: false, message: "Missing required approval params" });
  }

  const generatedPassword = generatePassword(10);
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(generatedPassword, saltRounds);
  const isErp = type === "erp";

  const portalUrl = isErp
    ? "https://synergy5m-business-4-profit-platform.azurewebsites.net/Login/Login"
    : "https://synergy5m-business-4-profit-platform.azurewebsites.net/";

  try {
    const pool = await poolPromise;

    // 1. Fetch dynamic role and trial duration details
    let dynamicUserRole = isErp ? "erp" : "buying-selling";
    let trialDays = 30; // Default fallback days

    if (!isErp) {
      const catResult = await pool.request()
        .input("Id", sql.Int, id)
        .query("SELECT [Category] FROM [dbo].[BusinessEnquiries] WHERE [Id] = @Id");

      if (catResult.recordset.length > 0 && catResult.recordset[0].Category) {
        dynamicUserRole = catResult.recordset[0].Category.trim();
      }
    } else {
      // Fetch SubscriptionPlan from TrialRequests to extract number of days
      const trialResult = await pool.request()
        .input("Id", sql.Int, id)
        .query("SELECT [SubscriptionPlan] FROM [dbo].[TrialRequests] WHERE [Id] = @Id");

      if (trialResult.recordset.length > 0) {
        const row = trialResult.recordset[0];
        const trialString = row.SubscriptionPlan || "";
        const match = String(trialString).match(/\d+/);
        if (match) {
          trialDays = parseInt(match[0], 10);
        }
      }
    }

    // Calculate dates for email display
    const startDateObj = new Date();
    const endDateObj = new Date();
    endDateObj.setDate(startDateObj.getDate() + trialDays);

    const formatDate = (date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const startDateStr = formatDate(startDateObj);
    const endDateStr = formatDate(endDateObj);

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 2. Insert into HRM_UserTbl using dynamic trial days and calculated end date
      const insertUserSql = `
        INSERT INTO [dbo].[HRM_UserTbl] (
          [username], [password], [AdminApprove], [StartDate],
          [NoOfDays], [EndDate], [IsSubscribed], [CHIEF_ADMIN], [SUPERADMIN],
          [DEPUTY_SUPERADMIN], [ADMIN], [DEPUTY_ADMIN], [USER], [UserRole],
          [MaterialManagement], [SalesAndMarketing], [HRAndAdmin], [AccountAndFinance],
          [Masters], [Dashboard], [ProductionAndQuality], [External_buyer_seller],
          [Emp_Code], [Power_Of_Authority], [NewAssignModule], [NOT_APPLICABLE], [IsActive]
        ) 
        OUTPUT INSERTED.id
        VALUES (
          @Username, @Password, 1, GETDATE(),
          @NoOfDays, ${isErp ? "DATEADD(day, @NoOfDays, GETDATE())" : "NULL"},  ${!isErp ? 0 : 1}, 0, 0,
          0, 0, 0, 1, @UserRole,
          0, 0, 0, 0,
          0, 1, 0, ${!isErp ? 1 : 0},
          'EMP' + RIGHT('0000' + CAST(ABS(CHECKSUM(NEWID())) % 10000 AS VARCHAR(10)), 4), 
          'User', 0, 0, 1
        );
      `;

      const userResult = await transaction.request()
        .input("Username", sql.NVarChar(150), email.trim().toLowerCase())
        .input("Password", sql.NVarChar(255), hashedPassword)
        .input("UserRole", sql.NVarChar(50), dynamicUserRole)
        // Buying-selling users have no trial period -> NoOfDays = NULL
        // (DATEADD(day, NULL, GETDATE()) also returns NULL, so EndDate = NULL)
        .input("NoOfDays", sql.Int, isErp ? trialDays : null)
        .query(insertUserSql);

      const newUserId = userResult.recordset[0]?.id;
      if (!newUserId) {
        throw new Error("Failed to retrieve generated UserId from HRM_UserTbl.");
      }

      // 3. Insert assigned modules into HRM_UserDetail
      const moduleFilterCondition = isErp
        ? "WHERE [ModuleCode] <> 'BuySell' AND [IsActive] = 1"
        : "WHERE [ModuleCode] = 'BuySell' AND [IsActive] = 1";

      await transaction.request()
        .input("UserId", sql.Int, newUserId)
        .query(`
          INSERT INTO [dbo].[HRM_UserDetail] ([UserId], [ModuleId], [IsTransferred], [IsActive])
          SELECT @UserId, [ModuleId], 0, 1
          FROM [dbo].[HRM_ModuleMaster]
          ${moduleFilterCondition};
        `);

      // 4. Insert assigned menus into HRM_UserMenuDetail
      const menuFilterCondition = isErp
        ? "WHERE [MenuCode] NOT LIKE 'BuySell%' AND [IsActive] = 1"
        : "WHERE [MenuCode] LIKE 'BuySell%' AND [IsActive] = 1";

      await transaction.request()
        .input("UserId", sql.Int, newUserId)
        .query(`
          INSERT INTO [dbo].[HRM_UserMenuDetail] ([UserId], [ModuleId], [MenuId], [SubMenuId], [IsActive], [IsTransferred])
          SELECT @UserId, [ModuleId], [MenuId], NULL, 1, 0
          FROM [dbo].[MenuMasterTbl]
          ${menuFilterCondition};
        `);

      // 5. Update status in source table
      if (isErp) {
        await transaction.request()
          .input("Id", sql.Int, id)
          .query(`UPDATE [dbo].[TrialRequests] SET TrialStatus = 'Approved' WHERE Id = @Id;`);
      } else {
        await transaction.request()
          .input("Id", sql.Int, id)
          .query(`UPDATE [dbo].[BusinessEnquiries] SET Status = 'Approved', UpdatedAt = GETDATE() WHERE Id = @Id;`);
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    // 6. Send Credentials Email with Trial Duration & Dates
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff; margin: 0 auto;">
        <h2 style="color: #0b5ed7; margin-top: 0;">Account Approved - Synergy 5M LLP</h2>
        
        <p style="font-size: 14px; line-height: 1.5;">Dear <strong>${recipientName || "Valued Partner"}</strong>,</p>
        
        <p style="font-size: 14px; line-height: 1.5;">
          Your request for <strong>${isErp ? "SYN ERP 10" : "Buyer-Seller Portal"}</strong> has been officially approved. 
          ${isErp ? `Your trial plan is <strong>${trialDays} Days</strong>, valid from <strong>${startDateStr}</strong> to <strong>${endDateStr}</strong>.` : ""}
          Your login credentials are ready:
        </p>

        <div style="background: #f7f9fa; border-left: 4px solid #0b5ed7; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 8px 0; font-size: 13.5px;">
            <strong>Login URL:</strong> 
            <a href="${portalUrl}" target="_blank" style="color: #0b5ed7; text-decoration: underline;">${portalUrl}</a>
          </p>
          <p style="margin: 0 0 8px 0; font-size: 13.5px;">
            <strong>Username / Email:</strong> ${email.trim()}
          </p>
          <p style="margin: 0; font-size: 13.5px;">
            <strong>Temporary Password:</strong> 
            <span style="font-family: monospace; font-size: 15px; background: #ffffff; padding: 3px 8px; border: 1px solid #ccd0d4; border-radius: 4px; font-weight: 600;">${generatedPassword}</span>
          </p>
        </div>

        <p style="color: #666; font-size: 13px; margin: 0 0 20px 0;">
          * Please change your password upon your initial login for security purposes.
        </p>

        ${isErp
        ? `
            <div style="margin-top: 24px; padding: 16px; background-color: #f0f7ff; border: 1px dashed #0b5ed7; border-radius: 6px;">
              <h4 style="margin: 0 0 6px 0; color: #0b5ed7; font-size: 14px;">Did you know? Synergy 5M also features a Buyer-Seller Portal</h4>
              <p style="margin: 0 0 10px 0; font-size: 13.5px; line-height: 1.5; color: #444;">
                Alongside your ERP suite, you can list raw materials, post product requirements, and connect directly with verified industrial manufacturers across India on our <strong>Buyer-Seller Portal</strong>.
              </p>
            </div>
            `
        : `
            <div style="margin-top: 24px; padding: 16px; background-color: #fcf9f2; border: 1px dashed #d97706; border-radius: 6px;">
              <h4 style="margin: 0 0 6px 0; color: #b45309; font-size: 14px;">Streamline Factory Operations with SYN ERP 10</h4>
              <p style="margin: 0 0 10px 0; font-size: 13.5px; line-height: 1.5; color: #444;">
                In addition to trading, Synergy 5M offers <strong>SYN ERP 10</strong>—an industrial ERP engineered for end-to-end plant operations covering Material Management, Production, Quality, Sales, and Accounting.
              </p>
            </div>
            `
      }

        <p style="margin-top: 24px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 14px;">
          This is an automated notification from Synergy 5M LLP. If you have questions, reach out to our team at 
          <a href="mailto:support@synergy5m.com" style="color: #0b5ed7;">support@synergy5m.com</a>.
        </p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Synergy5M Approvals" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
        to: email.trim(),
        cc: ["accounts@synergy5m.com"],
        subject: `Your Account has been Approved - ${isErp ? "SYN ERP 10" : "Buyer_Seller_Portal"}`,
        html: mailHtml,
      });
    } catch (mailErr) {
      console.warn("Mail dispatch error on approve:", mailErr.message);
    }

    return res.json({ success: true, message: "Record approved, account created, and email sent successfully!" });
  } catch (error) {
    console.error("Approve endpoint error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/admin/reject", verifyAdminToken, async (req, res) => {
  const { id, type, email, recipientName, reason } = req.body;
  if (!id || !type || !email || !reason) {
    return res.status(400).json({ success: false, message: "Missing required rejection parameters or reason" });
  }

  try {
    const pool = await poolPromise;

    if (type === "erp") {
      await pool.request()
        .input("Id", sql.Int, id)
        .input("Reason", sql.NVarChar(sql.MAX), reason)
        .query(`UPDATE [dbo].[TrialRequests] SET TrialStatus = 'Rejected', Remarks = ISNULL(Remarks + ' | ', '') + 'Rejection Reason: ' + @Reason WHERE Id = @Id;`);
    } else {
      await pool.request()
        .input("Id", sql.Int, id)
        .query(`UPDATE [dbo].[BusinessEnquiries] SET Status = 'Rejected', UpdatedAt = GETDATE() WHERE Id = @Id;`);
    }

    const mailHtml = `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; border: 1px solid #f1c1c1; border-radius: 8px; padding: 24px;">
        <h2 style="color: #d9534f;">Request Update - Synergy 5M</h2>
        <p>Dear <strong>${recipientName || "Valued User"}</strong>,</p>
        <p>Thank you for your interest in <strong>${type === "erp" ? "SYN ERP 10" : "Synergy Buyer_Seller_Portal"}</strong>.</p>
        <p>After reviewing your submission, your request could not be approved at this moment.</p>
        <div style="background: #fdf7f7; border-left: 4px solid #d9534f; padding: 15px; margin: 20px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Reason provided by Verification Team:</strong></p>
          <p style="margin: 0; color: #555;">${reason}</p>
        </div>
        <p>If you believe this was an error or wish to provide updated verification details, please reply directly to this email.</p>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Synergy5M Verification Desk" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
        to: email.trim(),
        cc: ["accounts@synergy5m.com"],
        subject: `Update Regarding Your Synergy 5M Request: Rejected`,
        html: mailHtml,
      });
    } catch (mailErr) {
      console.warn("Mail dispatch error on reject:", mailErr.message);
    }

    return res.json({ success: true, message: "Request rejected and rejection email sent successfully." });
  } catch (error) {
    console.error("Reject endpoint error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// -------------------------------------------------------------
// Demo Request Admin Endpoints (Using shared poolPromise)
// -------------------------------------------------------------

// GET /api/admin/demo-requests (Paginated & Filtered)
app.get('/api/admin/demo-requests', verifyAdminToken, async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const statusFilter = (req.query.status || 'All').trim();
  const offset = (page - 1) * limit;

  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database pool not available");

    let request = pool.request()
      .input('Offset', sql.Int, offset)
      .input('Limit', sql.Int, limit);

    let whereClause = "WHERE 1=1";
    if (statusFilter !== 'All') {
      request.input('StatusFilter', sql.NVarChar, statusFilter);
      whereClause += " AND [DemoStatus] = @StatusFilter";
    }

    const result = await request.query(`
            SELECT [Id], [fullName], [Email], [BusinessEmail], [CompanyName], [OfficialMobile], [PreferredDate], [TimeSlot], [MeetingPlatform], [Requirement], [DemoStatus], [CreatedAt], [UpdatedAt],
                   COUNT(*) OVER() AS TotalCount
            FROM [dbo].[DemoRequests]
            ${whereClause}
            ORDER BY [CreatedAt] DESC
            OFFSET @Offset ROWS
            FETCH NEXT @Limit ROWS ONLY;
        `);

    const records = result.recordset;
    const totalRecords = records.length > 0 ? records[0].TotalCount : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching demo requests:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/demo-requests/:id/approve
app.post('/api/admin/demo-requests/:id/approve', verifyAdminToken, async (req, res) => {
  const { id } = req.params;
  const { meetingDate, meetingTime, meetingLink, hostName, ccEmails } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database pool not available");

    // 1. Fetch user details and current DemoStatus
    const userResult = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Email, BusinessEmail, fullName, DemoStatus FROM [dbo].[DemoRequests] WHERE Id = @Id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Demo request not found' });
    }

    const user = userResult.recordset[0];

    // Validation: Check if already submitted or done
    if (user.DemoStatus === 'Submitted' || user.DemoStatus === 'Done') {
      return res.status(400).json({
        error: `Meeting email is already submitted. Current status is '${user.DemoStatus}'.`
      });
    }

    const targetEmail = user.BusinessEmail && user.BusinessEmail.trim() !== ''
      ? user.BusinessEmail
      : user.Email;

    if (!targetEmail) {
      return res.status(400).json({ error: 'No valid email address found for this user.' });
    }

    // 2. Update DemoStatus to 'Submitted'
    await pool.request()
      .input('Id', sql.Int, id)
      .query("UPDATE [dbo].[DemoRequests] SET [DemoStatus] = 'Submitted', [UpdatedAt] = GETDATE() WHERE [Id] = @Id");

    // 3. Send Email to User with CC
    const mailOptions = {
      from: `"Synergy Support" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
      to: targetEmail,
      cc: ccEmails && ccEmails.length > 0 ? ccEmails : ['sales@synergy5m.com', 'accounts@synergy5m.com'],
      subject: 'Your Demo is Approved - Meeting Details Inside',
      html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        
        <!-- Header Banner Area -->
        <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #14524A; margin: 0; font-size: 22px;">Synergy5M LLP</h2>
            <p style="color: #64748b; font-size: 13px; margin: 5px 0 0 0;">Enterprise Resource Planning & Business Solutions</p>
        </div>

        <h3 style="color: #1e293b; font-size: 18px;">Hello ${user.fullName},</h3>
        
        <p style="font-size: 14px; color: #475569;">
            Thank you for booking a live software demonstration with Synergy5M! We are thrilled to show you how our platform can streamline your manufacturing and operational workflow.
        </p>

        <p style="font-size: 14px; color: #475569;">
            Your demo request has been reviewed and officially approved. Below are your scheduled session credentials:
        </p>

        <!-- Meeting Details Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #14524A; padding: 18px; border-radius: 6px; margin: 20px 0;">
            <ul style="list-style-type: none; padding-left: 0; margin: 0;">
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>📅 Scheduled Date:</strong> ${meetingDate}</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>⏰ Time Slot:</strong> ${meetingTime}</li>
                <li style="margin-bottom: 10px; font-size: 14px;"><strong>👤 Session Host / Presenter:</strong> ${hostName}</li>
                <li style="font-size: 14px;"><strong>🔗 Access Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #0b5ed7; text-decoration: underline;">Join Virtual Conference</a></li>
            </ul>
        </div>

        <!-- Additional Professional Guidance / Next Steps -->
        <div style="background-color: #fefce8; border: 1px solid #fde047; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 6px 0; color: #854d0e; font-size: 13.5px;">💡 Tips for a Productive Session:</h4>
            <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #713f12;">
                <li>Please join 2–3 minutes prior to test your audio and video settings.</li>
                <li>Feel free to have key stakeholders or department heads join the call.</li>
                <li>Keep a list of your specific operational requirements or questions handy.</li>
            </ul>
        </div>

        <p style="font-size: 14px; color: #475569;">
            If you need to reschedule or have any immediate queries before the session, simply reply directly to this email or contact our support team.
        </p>

        <p style="font-size: 14px; color: #475569; margin-bottom: 30px;">
            We look forward to connecting with you soon!
        </p>

        <p style="font-size: 14px; color: #1e293b; margin: 0;">Warm regards,</p>
        <p style="font-size: 14px; font-weight: bold; color: #14524A; margin: 4px 0 0 0;">The Synergy5M Demo & Support Team</p>

        <!-- Footer Note -->
        <div style="border-top: 1px solid #f1f5f9; margin-top: 25px; padding-top: 15px; text-align: center;">
            <p style="font-size: 11.5px; color: #94a3b8; margin: 0;">
                This is an automated administrative notification from Synergy5M LLP. Please do not share personal credentials publicly.
            </p>
        </div>
    </div>
`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Demo approved and email sent successfully.' });
  } catch (error) {
    console.error('Error approving demo:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/demo-requests/:id/feedback
// (The old duplicate of this route has been removed - Express only ever used the first one.)
app.post('/api/admin/demo-requests/:id/feedback', verifyAdminToken, async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    if (!pool) throw new Error("Database pool not available");

    const userResult = await pool.request()
      .input('Id', sql.Int, id)
      .query('SELECT Email, BusinessEmail, fullName, DemoStatus FROM [dbo].[DemoRequests] WHERE Id = @Id');

    if (userResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Demo request not found' });
    }

    const user = userResult.recordset[0];

    // Validation: Check if demo is already given / done
    if (user.DemoStatus === 'Done') {
      return res.status(400).json({ error: 'The demo is already given (marked as Done).' });
    }

    const targetEmail = user.BusinessEmail || user.Email;

    // Update status to 'Done'
    await pool.request()
      .input('Id', sql.Int, id)
      .query("UPDATE [dbo].[DemoRequests] SET [DemoStatus] = 'Done', [UpdatedAt] = GETDATE() WHERE [Id] = @Id");

    // Send Feedback Form Email
    const feedbackUrl = `https://docs.google.com/forms/d/e/1FAIpQLSfOjo33zKew6F9sGSm1yjPDX9W48rDCSlDjndpv5C2uNPz2qA/viewform?usp=publish-editor`;
    const mailOptions = {
      from: `"Synergy Support" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
      to: targetEmail,
      subject: 'We value your feedback on the demo',
      html: `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #333333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
        
        <!-- Header Banner Area -->
        <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #14524A; margin: 0; font-size: 22px;">Synergy5M LLP</h2>
            <p style="color: #64748b; font-size: 13px; margin: 5px 0 0 0;">Enterprise Resource Planning & Business Solutions</p>
        </div>

        <h3 style="color: #1e293b; font-size: 18px;">Hello ${user.fullName},</h3>
        
        <p style="font-size: 14px; color: #475569;">
            Thank you for taking the time to attend our live product demonstration today. We hope you found the session insightful and that you could see how Synergy5M can add value to your operations!
        </p>

        <p style="font-size: 14px; color: #475569;">
            We are constantly striving to improve our presentations and platform features. Your feedback matters greatly to us—could you please spare just 2 minutes to share your thoughts?
        </p>

        <!-- Call-to-Action Button Box -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${feedbackUrl}" target="_blank" style="background-color: #059669; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.2);">
                ✨ Share Your Feedback
            </a>
        </div>

        <p style="font-size: 13.5px; color: #64748b; text-align: center;">
            If the button above doesn't work, you can copy and paste this link into your browser:<br/>
            <a href="${feedbackUrl}" target="_blank" style="color: #0b5ed7; word-break: break-all; font-size: 12px;">${feedbackUrl}</a>
        </p>

        <p style="font-size: 14px; color: #475569; margin-top: 30px;">
            If you have any follow-up technical questions or require a custom proposal, please feel free to reply directly to this email.
        </p>

        <p style="font-size: 14px; color: #1e293b; margin: 0;">Thank you once again,</p>
        <p style="font-size: 14px; font-weight: bold; color: #14524A; margin: 4px 0 0 0;">The Synergy5M Team</p>

        <!-- Footer Note -->
        <div style="border-top: 1px solid #f1f5f9; margin-top: 25px; padding-top: 15px; text-align: center;">
            <p style="font-size: 11.5px; color: #94a3b8; margin: 0;">
                This is an automated post-demo notification from Synergy5M LLP.
            </p>
        </div>
    </div>
`
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'Status updated to Done and feedback email sent.' });
  } catch (error) {
    console.error('Error sending feedback mail:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get unique categories for Buying and Selling Enquiries
app.get('/api/enquiry-categories', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: "Database connection not available" });

    const result = await pool.request().query(`
            SELECT DISTINCT ProdCat AS Category FROM [dbo].[BuyingEnquiryTbl] WHERE ProdCat IS NOT NULL AND LTRIM(RTRIM(ProdCat)) <> ''
            UNION
            SELECT DISTINCT ItemCat AS Category FROM [dbo].[SellingEnquiryTbl] WHERE ItemCat IS NOT NULL AND LTRIM(RTRIM(ItemCat)) <> ''
            UNION
            SELECT DISTINCT Category AS Category FROM [dbo].[CollectiveProducts] WHERE Category IS NOT NULL AND LTRIM(RTRIM(Category)) <> ''
            UNION
            SELECT DISTINCT Category AS Category FROM [dbo].[Potential_Vendor] WHERE Category IS NOT NULL AND LTRIM(RTRIM(Category)) <> ''
            ORDER BY Category ASC
        `);

    const categories = result.recordset.map(row => row.Category);
    return res.json(categories);
  } catch (err) {
    console.error("Error fetching enquiry categories:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// 1. Get Buying Enquiries (with optional Category filter & Mapped Email)
app.get('/api/buying', verifyAdminToken, async (req, res) => {
  try {
    const { category } = req.query;
    const pool = await poolPromise;
    let query = `
            SELECT b.*, u.username AS UserEmail 
            FROM [dbo].[BuyingEnquiryTbl] b
            LEFT JOIN [dbo].[HRM_UserTbl] u ON b.UID = u.id
            WHERE b.IsActive = 1
        `;

    const request = pool.request();
    if (category) {
      query += ` AND b.ProdCat = @category`;
      request.input('category', sql.VarChar, category);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Selling Enquiries (with optional Category filter & Mapped Email)
app.get('/api/selling', verifyAdminToken, async (req, res) => {
  try {
    const { category } = req.query;
    const pool = await poolPromise;
    let query = `
            SELECT s.*, u.username AS UserEmail 
            FROM [dbo].[SellingEnquiryTbl] s
            LEFT JOIN [dbo].[HRM_UserTbl] u ON s.UID = u.id
            WHERE s.IsActive = 1
        `;

    const request = pool.request();
    if (category) {
      query += ` AND s.ItemCat = @category`;
      request.input('category', sql.VarChar, category);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Potential Vendors filtered by Category (Robust against case, spaces, and null IsActive)
app.get('/api/potential-vendors', verifyAdminToken, async (req, res) => {
  try {
    const { category } = req.query;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: "Database connection not available" });

    let query = `
            SELECT * FROM [dbo].[Potential_Vendor] 
            WHERE (IsActive = 1 OR IsActive IS NULL)
        `;

    const request = pool.request();
    if (category) {
      query += ` AND UPPER(LTRIM(RTRIM(Category))) = UPPER(LTRIM(RTRIM(@category)))`;
      request.input('category', sql.VarChar, category);
    }

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching potential vendors:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get Collective Buying Enquiries for EnquiryMapper (Submit Offer dispatch)
app.get('/api/collective-enquiries-for-vendors', verifyAdminToken, async (req, res) => {
  try {
    const { category } = req.query;
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: "Database connection not available" });

    let query = `
            SELECT 
                ce.Id,
                ce.ProductId,
                ce.ProductName,
                COALESCE(cp.Category, 'General Industrial') AS ProdCat,
                COALESCE(cp.Category, 'General Industrial') AS Category,
                cp.GradeVariant,
                ce.RequiredQuantity AS ReqQty,
                ce.RequiredQuantity,
                ce.Uom,
                ce.DeliveryLocation AS DelLoc,
                ce.DeliveryLocation,
                ce.TargetDeliveryDate AS ReqDelDate,
                ce.TargetDeliveryDate,
                ce.CompanyName,
                ce.ContactPerson,
                ce.Email,
                ce.Phone,
                ce.Comments,
                ce.Status,
                ce.CreatedAt
            FROM [dbo].[CollectiveEnquiries] ce
            LEFT JOIN [dbo].[CollectiveProducts] cp ON ce.ProductId = cp.Id
            WHERE (ce.Status = 'Submitted' OR ce.Status = 'In Review' OR ce.Status IS NULL OR ce.Status = 'Allocated to Pool')
        `;

    const request = pool.request();
    if (category) {
      query += ` AND UPPER(LTRIM(RTRIM(COALESCE(cp.Category, '')))) = UPPER(LTRIM(RTRIM(@category)))`;
      request.input('category', sql.VarChar, category);
    }

    query += ` ORDER BY ce.Id DESC`;

    const result = await request.query(query);
    return res.json(result.recordset || []);
  } catch (err) {
    console.error("Error fetching collective enquiries for vendors:", err);
    return res.status(500).json({ error: err.message });
  }
});
// Helper function for professional HTML email structure


// If using ES modules / React, or use require in Node.js: 

const generateStyledEmailHtml = (recipientName, enquiryTitle, detailsHtml, isBuyerLead, customIntro, customCtaUrl, customCtaText) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${enquiryTitle} - Synergy5M LLP</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #fff7ed; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #334155;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; padding: 30px 0;">
            <tr>
                <td align="center">
                    <table width="650" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.08); border: 1px solid #fed7aa;">
                        
                        <!-- Top Orange & White Header Banner -->
                       <tr>
                            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 22px 30px; text-align: left;">
                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td width="55" style="vertical-align: middle;">
                                            <div style="width: 48px; height: 48px; background: #ffffff; border-radius: 5%; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #ffffff; text-align: center; line-height: 48px; overflow: hidden;">
                                              <img src="https://synergy5m.com/static/media/synlogo.dec9f1f0bc07e146500b.png" alt="Synergy5M Logo" style="width: 65px; height: 65px; object-fit: contain; vertical-align: middle;" />
                                 </div>
                                        </td>
                                        <td style="vertical-align: middle; padding-left: 14px;">
                                            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">Synergy5M LLP</h1>
                                            <p style="color: #ffedd5; margin: 2px 0 0 0; font-size: 12.5px; font-weight: 500;">Verified B2B Global Trade & Supply Chain</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Main Content Area -->
                        <tr>
                            <td style="padding: 20px 40px 30px 40px;">
                                <h2 style="color: #1e293b; font-size: 20px; margin-top: 5px; margin-bottom: 14px; font-weight: 600;">
                                    Hello ${recipientName || 'Valued Partner'},
                                </h2>
                                
                                <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
                                    ${customIntro || (isBuyerLead
      ? `We have identified a new purchase requirement matching your business profile and product category. Please review the specifications below and submit your competitive quotation.`
      : `We have an active product offering available in your category. Please review the offer specifications below if interested in procurement.`
    )}
                                </p>

                                <!-- Specification Card Grid -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffaf5; border: 1px solid #fed7aa; border-radius: 12px; margin-bottom: 28px;">
                                    <tr>
                                        <td style="padding: 22px;">
                                            <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 14px;">
                                                ${detailsHtml}
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Call to Action Buttons -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align: center; margin-bottom: 28px;">
                                    <tr>
                                        <td>
                                            <a href="${customCtaUrl || 'https://synergy5m-business-4-profit-platform.azurewebsites.net/'}" target="_blank" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 13px 26px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35); margin-right: 12px;">
                                                ${customCtaText || '🚀 View & Respond Now'}
                                            </a>
                                            <a href="https://synergy5m.com/" target="_blank" style="background: linear-gradient(135deg, #334155 0%, #1e293b 100%); color: #ffffff; padding: 13px 26px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(51, 65, 85, 0.35);">
                                                🌐 Synergy Web
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Trade Safety Advisory -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 20px;">
                                    <tr>
                                        <td style="padding: 14px 18px; font-size: 12.5px; color: #92400e; line-height: 1.5;">
                                            <strong>⚠️ Trade Safety Advisory:</strong> Stick to secure payment instruments such as Letter of Credit (LC) and complete due diligence on trading partners.
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #fffaf5; padding: 22px 40px; border-top: 1px solid #fed7aa; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
                                <p style="margin: 0 0 4px 0; font-weight: 600; color: #334155;">Synergy5M LLP & Trade Network</p>
                                <p style="margin: 0; color: #94a3b8;">Pune, Maharashtra, India | sales@synergy5m.com</p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
};

// Combined Email Dispatcher for Buying/Selling Enquiries to Potential Vendors
app.post('/api/send-enquiry-email', verifyAdminToken, async (req, res) => {
  const { buyerEnqIds, sellerEnqIds, collectiveEnqIds, vendorIds, mode, enquiriesData } = req.body;

  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ error: "Database connection not available" });

    // Clean and validate vendor IDs
    const cleanVendorIds = (Array.isArray(vendorIds) ? vendorIds : [])
      .map(v => parseInt(v, 10))
      .filter(v => !isNaN(v) && v > 0);

    if (cleanVendorIds.length === 0) {
      return res.status(400).json({ error: "Please select at least one vendor." });
    }

    // Fetch selected vendors in ONE bulk query
    const vReq = pool.request();
    cleanVendorIds.forEach((id, idx) => vReq.input(`vid_${idx}`, sql.Int, id));
    const vQuery = `SELECT * FROM [dbo].[Potential_Vendor] WHERE Id IN (${cleanVendorIds.map((_, idx) => `@vid_${idx}`).join(', ')})`;
    const vRes = await vReq.query(vQuery);
    const vendors = vRes.recordset.filter(v => v.Email && v.Email.includes('@'));

    if (vendors.length === 0) {
      return res.status(400).json({ error: "None of the selected vendors have a valid email address." });
    }

    const salesEmail = process.env.SALES_EMAIL || process.env.SMTP_USER || "sales@synergy5m.com";

    // =========================================================================
    // Mode 1: Send Buying Enquiries to Selected Vendors
    // =========================================================================
    if (mode === 'vendor-buying' && buyerEnqIds) {
      const cleanBuyerIds = (Array.isArray(buyerEnqIds) ? buyerEnqIds : [])
        .map(b => parseInt(b, 10))
        .filter(b => !isNaN(b) && b > 0);

      if (cleanBuyerIds.length === 0) {
        return res.status(400).json({ error: "No valid buying enquiries selected." });
      }

      const bReq = pool.request();
      cleanBuyerIds.forEach((id, idx) => bReq.input(`bid_${idx}`, sql.Int, id));
      const bQuery = `
                SELECT b.*, u.username as UserEmail 
                FROM [dbo].[BuyingEnquiryTbl] b 
                LEFT JOIN [dbo].[HRM_UserTbl] u ON b.UID = u.id 
                WHERE b.Id IN (${cleanBuyerIds.map((_, idx) => `@bid_${idx}`).join(', ')})
            `;
      const bRes = await bReq.query(bQuery);
      const buyers = bRes.recordset;

      if (buyers.length === 0) {
        return res.status(400).json({ error: "Selected buying enquiries not found." });
      }

      const tasks = [];
      for (const buyer of buyers) {
        const detailsRows = `
                    <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Enquiry No:</td><td style="color: #1e293b; font-weight: 700;">${buyer.EnqNo || 'N/A'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Product Name:</td><td style="color: #1e293b; font-weight: 700;">${buyer.ProdName}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${buyer.ProdCat || 'N/A'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Grade / Specs:</td><td style="color: #334155;">${buyer.Grade || 'Standard'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">HSN:</td><td style="color: #334155;">${buyer.HSN || 'Standard'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Payment Terms:</td><td style="color: #334155;">${buyer.PayTerms || 'Standard'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Required Qty:</td><td style="color: #ea580c; font-weight: 700;">${buyer.ReqQty} ${buyer.UOM}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Delivery Location:</td><td style="color: #334155;">${buyer.DelLoc || 'CIF'} (${buyer.ReqDelDate || 'Domestic'})</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Region:</td><td style="color: #334155;">${buyer.DomImport || 'Standard'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Enquiry Valid Till:</td><td style="color: #334155;">${buyer.EnqValDate || 'Standard'}</td></tr>
                `;

        for (const vendor of vendors) {
          const mailHtml = generateStyledEmailHtml(
            vendor.Contact_Person || vendor.Company_Name,
            'Purchase Requirement Inquiry',
            detailsRows,
            true
          );

          const buyingCc = [salesEmail, buyer.UserEmail].filter(
            (em, idx, arr) => em && em.toLowerCase() !== (vendor.Email || '').toLowerCase() && arr.indexOf(em) === idx
          );

          tasks.push({
            to: vendor.Email,
            mailOptions: {
              from: process.env.SMTP_USER || "sales@synergy5m.com",
              to: vendor.Email,
              cc: buyingCc.length > 0 ? buyingCc : undefined,
              subject: `New Buy Lead: ${buyer.ProdName} (${buyer.ReqQty} ${buyer.UOM})`,
              html: mailHtml
            }
          });
        }
      }

      // Immediately send HTTP success response to prevent ANY gateway timeout
      res.json({
        success: true,
        totalVendors: vendors.length,
        totalEmails: tasks.length,
        message: `Buying enquiries successfully dispatched to ${vendors.length} selected vendor${vendors.length === 1 ? '' : 's'}!`
      });

      // Dispatch emails asynchronously in background
      dispatchEmailTasksInBackground(tasks, 'Vendor-Buying');
      return;
    }

    // =========================================================================
    // Mode 2: Send Selling Enquiries to Selected Vendors
    // =========================================================================
    if (mode === 'vendor-selling' && sellerEnqIds) {
      const cleanSellerIds = (Array.isArray(sellerEnqIds) ? sellerEnqIds : [])
        .map(s => parseInt(s, 10))
        .filter(s => !isNaN(s) && s > 0);

      if (cleanSellerIds.length === 0) {
        return res.status(400).json({ error: "No valid selling enquiries selected." });
      }

      const sReq = pool.request();
      cleanSellerIds.forEach((id, idx) => sReq.input(`sid_${idx}`, sql.Int, id));
      const sQuery = `
                SELECT s.*, u.username as UserEmail 
                FROM [dbo].[SellingEnquiryTbl] s 
                LEFT JOIN [dbo].[HRM_UserTbl] u ON s.UID = u.id 
                WHERE s.Id IN (${cleanSellerIds.map((_, idx) => `@sid_${idx}`).join(', ')})
            `;
      const sRes = await sReq.query(sQuery);
      const sellers = sRes.recordset;

      if (sellers.length === 0) {
        return res.status(400).json({ error: "Selected selling enquiries not found." });
      }

      const tasks = [];
      for (const seller of sellers) {
        const detailsRows = `
                    <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Offer No:</td><td style="color: #1e293b; font-weight: 700;">${seller.OfferNo || 'N/A'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Product Name:</td><td style="color: #1e293b; font-weight: 700;">${seller.ProdName}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${seller.ItemCat || 'N/A'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Grade:</td><td style="color: #334155;">${seller.Grade || 'Standard'}</td></tr>
                    <tr><td style="color: #ea580c; font-weight: 600;">Quantity Offered:</td><td style="color: #ea580c; font-weight: 700;">${seller.QuantityOffered} ${seller.UOM}</td></tr>
                `;

        for (const vendor of vendors) {
          const mailHtml = generateStyledEmailHtml(
            vendor.Contact_Person || vendor.Company_Name,
            'Product Offering Notice',
            detailsRows,
            false
          );

          const sellingCc = [salesEmail, seller.UserEmail].filter(
            (em, idx, arr) => em && em.toLowerCase() !== (vendor.Email || '').toLowerCase() && arr.indexOf(em) === idx
          );

          tasks.push({
            to: vendor.Email,
            mailOptions: {
              from: process.env.SMTP_USER || "sales@synergy5m.com",
              to: vendor.Email,
              cc: sellingCc.length > 0 ? sellingCc : undefined,
              subject: `New Selling Offer: ${seller.ProdName} (${seller.QuantityOffered} ${seller.UOM})`,
              html: mailHtml
            }
          });
        }
      }

      res.json({
        success: true,
        totalVendors: vendors.length,
        totalEmails: tasks.length,
        message: `Selling offers successfully dispatched to ${vendors.length} selected vendor${vendors.length === 1 ? '' : 's'}!`
      });

      dispatchEmailTasksInBackground(tasks, 'Vendor-Selling');
      return;
    }

    // =========================================================================
    // Mode 3: Send Collective Buying Enquiries to Selected Category Vendors to Submit Offer
    // =========================================================================
    if (mode === 'submit-offer' || mode === 'vendor-collective') {
      let enquiriesToProcess = [];

      // If full enquiry objects passed directly from frontend, use them
      if (Array.isArray(enquiriesData) && enquiriesData.length > 0) {
        enquiriesToProcess = enquiriesData;
      } else {
        const rawEnqIds = collectiveEnqIds || buyerEnqIds || [];
        const cleanEnqIds = (Array.isArray(rawEnqIds) ? rawEnqIds : [])
          .map(e => parseInt(e, 10))
          .filter(e => !isNaN(e) && e > 0);

        if (cleanEnqIds.length > 0) {
          const eReq = pool.request();
          cleanEnqIds.forEach((id, idx) => eReq.input(`eid_${idx}`, sql.Int, id));
          const eQuery = `
                        SELECT ce.*, cp.Category AS ProdCat, cp.GradeVariant 
                        FROM [dbo].[CollectiveEnquiries] ce 
                        LEFT JOIN [dbo].[CollectiveProducts] cp ON ce.ProductId = cp.Id 
                        WHERE ce.Id IN (${cleanEnqIds.map((_, idx) => `@eid_${idx}`).join(', ')})
                    `;
          const eRes = await eReq.query(eQuery);
          enquiriesToProcess = eRes.recordset;
        }
      }

      if (enquiriesToProcess.length === 0) {
        return res.status(400).json({ error: "No valid enquiry requirements selected." });
      }

      // 1. Calculate Aggregate Summary across all combined buyer requirements
      let totalAggregatedQuantity = 0;
      const uom = enquiriesToProcess[0]?.Uom || enquiriesToProcess[0]?.uom || 'MT';
      const prodName = enquiriesToProcess[0]?.ProductName || enquiriesToProcess[0]?.productName || 'Industrial Product';
      const prodCat = enquiriesToProcess[0]?.ProdCat || enquiriesToProcess[0]?.Category || enquiriesToProcess[0]?.category || 'Industrial';
      const grade = enquiriesToProcess[0]?.GradeVariant || enquiriesToProcess[0]?.Grade || enquiriesToProcess[0]?.grade || 'Commercial Grade';
      const prodId = enquiriesToProcess[0]?.ProductId || enquiriesToProcess[0]?.productId;

      const uniqueDestinations = new Set();
      enquiriesToProcess.forEach(e => {
        const q = parseFloat(e.RequiredQuantity || e.ReqQty || e.quantity || 0) || 0;
        totalAggregatedQuantity += q;
        const loc = e.DeliveryLocation || e.DelLoc || e.region;
        if (loc) uniqueDestinations.add(loc);
      });

      const deliveryDestinationsSummary = Array.from(uniqueDestinations).join(', ') || 'As per buyer network';

      // 2. Specific Itemized Table of all combined buyer requirements
      const buyerRowsHtml = enquiriesToProcess.map((enq, idx) => {
        const enqRef = enq.Id || enq.id ? `#CE-${enq.Id || enq.id}` : `Ref #${idx + 1}`;
        const buyerName = 'Verified  Buyer from ';
        const loc = enq.DeliveryLocation || enq.DelLoc || enq.region || 'Standard Dock';
        const q = enq.RequiredQuantity || enq.ReqQty || enq.quantity || '-';
        const targetDate = enq.TargetDeliveryDate || enq.targetDeliveryDate;
        const targetDateStr = targetDate
          ? new Date(targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Open / Flexible';
        const remarks = enq.Comments || enq.comments;

        return `
                    <tr style="border-bottom: 1px solid #fed7aa; background-color: ${idx % 2 === 0 ? '#ffffff' : '#fffaf5'};">
                        <td style="padding: 10px; font-weight: 700; color: #ea580c; white-space: nowrap;">${enqRef}</td>
                        <td style="padding: 10px; color: #1e293b;">
                            <strong>${buyerName}</strong>
                            <div style="font-size: 11.5px; color: #64748b;">📍 ${loc}</div>
                            ${remarks ? `<div style="font-size: 11px; color: #94a3b8; font-style: italic;">Note: ${remarks}</div>` : ''}
                        </td>
                        <td style="padding: 10px; font-weight: 700; text-align: right; color: #0f172a; white-space: nowrap;">${q} ${uom}</td>
                        <td style="padding: 10px; color: #475569; font-size: 12px; white-space: nowrap;">${targetDateStr}</td>
                    </tr>
                `;
      }).join('');

      const detailsRows = `
                <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Product:</td><td style="color: #1e293b; font-weight: 700; font-size: 15px;">${prodName}</td></tr>
                <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${prodCat}</td></tr>
                <tr><td style="color: #ea580c; font-weight: 600;">Grade / Specs:</td><td style="color: #334155;">${grade}</td></tr>
                <tr>
                    <td style="color: #ea580c; font-weight: 600;">Total Aggregated Demand:</td>
                    <td style="color: #087f82; font-weight: 800; font-size: 16px;">
                        ${totalAggregatedQuantity > 0 ? totalAggregatedQuantity : 'Consolidated'} ${uom}
                        <span style="font-size: 12px; font-weight: normal; color: #64748b;">(${enquiriesToProcess.length} verified requirement${enquiriesToProcess.length === 1 ? '' : 's'} combined)</span>
                    </td>
                </tr>
                <tr><td style="color: #ea580c; font-weight: 600;">Delivery Destinations:</td><td style="color: #334155;">${deliveryDestinationsSummary}</td></tr>
                <tr>
                    <td colspan="2" style="padding-top: 16px;">
                        <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px; font-size: 13.5px;">
                            📋 Consolidated Buyer Enquiries Breakdown (${enquiriesToProcess.length}):
                        </div>
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #fed7aa; border-radius: 8px; overflow: hidden; font-size: 12.5px;">
                            <thead>
                                <tr style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff;">
                                    <th style="padding: 9px 10px; text-align: left; font-size: 12px;">Ref</th>
                                    <th style="padding: 9px 10px; text-align: left; font-size: 12px;">Buyer & Destination</th>
                                    <th style="padding: 9px 10px; text-align: right; font-size: 12px;">Demand Qty</th>
                                    <th style="padding: 9px 10px; text-align: left; font-size: 12px;">Target Schedule</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${buyerRowsHtml}
                            </tbody>
                        </table>
                    </td>
                </tr>
            `;

      const rfqRef = `RFQ-CB-${new Date().getFullYear()}-${String(prodId || '001').padStart(4, '0')}`;
      const appBaseUrl = process.env.APP_BASE_URL || (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'https://synergy5m.com');
      const customIntro = `We have aggregated verified buyer demand in your product category (${prodCat}). Below is the consolidated opportunity combining all active buyer enquiries into this single RFQ. Please review the aggregate demand and specific breakdown, then submit your competitive supply quotation / offer.`;

      // SEND ONLY ONE EMAIL PER VENDOR (combining all offers & aggregate into one email)
      const tasks = [];
      const sentOfferRecords = [];

      for (const vendor of vendors) {
        const vendorDisplayName = vendor.Company_Name || vendor.Contact_Person || '';
        const vendorEmailAddress = vendor.Email || '';
        const submitOfferUrl = `${appBaseUrl}/supply-offer?rfq=${encodeURIComponent(rfqRef)}&prodId=${encodeURIComponent(prodId || '')}&vendor=${encodeURIComponent(vendorDisplayName)}&email=${encodeURIComponent(vendorEmailAddress)}&product=${encodeURIComponent(prodName || '')}&category=${encodeURIComponent(prodCat || '')}&grade=${encodeURIComponent(grade || '')}&demand=${encodeURIComponent(totalAggregatedQuantity || 0)}&uom=${encodeURIComponent(uom || 'MT')}&dest=${encodeURIComponent(deliveryDestinationsSummary || '')}`;

        const mailHtml = generateStyledEmailHtml(
          vendor.Contact_Person || vendor.Company_Name,
          'Consolidated Procurement Opportunity - Submit Supply Offer',
          detailsRows,
          true,
          customIntro,
          submitOfferUrl,
          '🚀 Submit Supply Offer Now'
        );

        const rfqMailOpts = {
          from: process.env.SMTP_USER || "sales@synergy5m.com",
          to: vendor.Email,
          subject: `RFQ: Consolidated Demand for ${prodName} (${totalAggregatedQuantity > 0 ? totalAggregatedQuantity + ' ' + uom : 'Aggregated'} across ${enquiriesToProcess.length} buyers)`,
          html: mailHtml
        };
        // Add Sales in CC when emailing Seller / Vendor
        if (salesEmail && vendor.Email && salesEmail.toLowerCase() !== vendor.Email.toLowerCase()) {
          rfqMailOpts.cc = salesEmail;
        }

        tasks.push({
          to: vendor.Email,
          mailOptions: rfqMailOpts
        });

        sentOfferRecords.push({
          rfqRef,
          prodId: String(prodId || ''),
          vendorId: vendor.Id ? parseInt(vendor.Id, 10) : null,
          vendorDisplayName,
          vendorEmailAddress,
          prodName,
          prodCat,
          grade,
          demand: Number(totalAggregatedQuantity) || 0,
          uom: uom || 'MT',
          destination: deliveryDestinationsSummary || '',
          enquiryCount: enquiriesToProcess.length || 1,
          submitOfferUrl
        });
      }

      // Record dispatched offers into database asynchronously
      (async () => {
        try {
          const pool = await poolPromise;
          if (pool && sentOfferRecords.length > 0) {
            await pool.request().query(`
              IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SentSupplyOffers' AND xtype='U')
              CREATE TABLE [dbo].[SentSupplyOffers] (
                  [Id] INT IDENTITY(1,1) PRIMARY KEY,
                  [RfqReference] NVARCHAR(100) NOT NULL,
                  [OpportunityId] NVARCHAR(100) NULL,
                  [VendorId] INT NULL,
                  [VendorName] NVARCHAR(255) NOT NULL,
                  [VendorEmail] NVARCHAR(255) NOT NULL,
                  [ProductName] NVARCHAR(255) NOT NULL,
                  [Category] NVARCHAR(255) NULL,
                  [Grade] NVARCHAR(255) NULL,
                  [TotalDemand] DECIMAL(18, 2) NOT NULL,
                  [Uom] NVARCHAR(50) DEFAULT 'MT',
                  [Destination] NVARCHAR(255) NULL,
                  [BuyerEnquiriesCount] INT DEFAULT 1,
                  [SubmitOfferUrl] NVARCHAR(MAX) NOT NULL,
                  [Status] NVARCHAR(50) DEFAULT 'Sent',
                  [SentAt] DATETIME DEFAULT GETDATE(),
                  [CreatedAt] DATETIME DEFAULT GETDATE()
              );
            `);

            for (const rec of sentOfferRecords) {
              const req = pool.request();
              req.input('RfqReference', sql.NVarChar(100), rec.rfqRef);
              req.input('OpportunityId', sql.NVarChar(100), rec.prodId);
              req.input('VendorId', sql.Int, rec.vendorId);
              req.input('VendorName', sql.NVarChar(255), rec.vendorDisplayName);
              req.input('VendorEmail', sql.NVarChar(255), rec.vendorEmailAddress);
              req.input('ProductName', sql.NVarChar(255), rec.prodName);
              req.input('Category', sql.NVarChar(255), rec.prodCat);
              req.input('Grade', sql.NVarChar(255), rec.grade);
              req.input('TotalDemand', sql.Decimal(18, 2), rec.demand);
              req.input('Uom', sql.NVarChar(50), rec.uom);
              req.input('Destination', sql.NVarChar(255), rec.destination);
              req.input('BuyerEnquiriesCount', sql.Int, rec.enquiryCount);
              req.input('SubmitOfferUrl', sql.NVarChar(sql.MAX), rec.submitOfferUrl);

              await req.query(`
                IF EXISTS (
                  SELECT 1 FROM [dbo].[SentSupplyOffers]
                  WHERE RfqReference = @RfqReference
                    AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProductName)))
                    AND LOWER(LTRIM(RTRIM(VendorName))) = LOWER(LTRIM(RTRIM(@VendorName)))
                )
                BEGIN
                  UPDATE [dbo].[SentSupplyOffers]
                  SET OpportunityId = @OpportunityId,
                      VendorId = COALESCE(@VendorId, VendorId),
                      VendorEmail = @VendorEmail,
                      Category = @Category,
                      Grade = @Grade,
                      TotalDemand = @TotalDemand,
                      Uom = @Uom,
                      Destination = @Destination,
                      BuyerEnquiriesCount = @BuyerEnquiriesCount,
                      SubmitOfferUrl = @SubmitOfferUrl,
                      Status = 'Sent',
                      SentAt = GETDATE()
                  WHERE RfqReference = @RfqReference
                    AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProductName)))
                    AND LOWER(LTRIM(RTRIM(VendorName))) = LOWER(LTRIM(RTRIM(@VendorName)));
                END
                ELSE
                BEGIN
                  INSERT INTO [dbo].[SentSupplyOffers] (
                    RfqReference, OpportunityId, VendorId, VendorName, VendorEmail,
                    ProductName, Category, Grade, TotalDemand, Uom, Destination,
                    BuyerEnquiriesCount, SubmitOfferUrl, Status, SentAt, CreatedAt
                  ) VALUES (
                    @RfqReference, @OpportunityId, @VendorId, @VendorName, @VendorEmail,
                    @ProductName, @Category, @Grade, @TotalDemand, @Uom, @Destination,
                    @BuyerEnquiriesCount, @SubmitOfferUrl, 'Sent', GETDATE(), GETDATE()
                  );
                END
              `);
            }
          }
        } catch (dbErr) {
          console.error("SentSupplyOffers logging warning:", dbErr.message);
        }
      })().catch(() => { });


      // Immediately send HTTP success response: NO MORE 504 GATEWAY TIMEOUT!
      res.json({
        success: true,
        totalEnquiries: enquiriesToProcess.length,
        totalVendors: vendors.length,
        totalEmails: tasks.length,
        message: `Enquiry successfully dispatched to ${vendors.length} selected vendor${vendors.length === 1 ? '' : 's'} to submit offers!`
      });

      // Dispatch emails asynchronously in background
      dispatchEmailTasksInBackground(tasks, 'Submit-Offer');
      return;
    }

    return res.status(400).json({ error: "Invalid mode or parameters provided." });
  } catch (err) {
    console.error("Email dispatch error");
    res.status(500).json({ error: err.message });
  }
});



const vendorRoutes = require('./vendorRoutes');
app.use('/', vendorRoutes);
const WhatsappRoute = require('./WhatsappRoute');
app.use('/whatsapp', WhatsappRoute);
const collectiveProductRoutes = require('./collectiveProductRoutes');
app.use('/api', collectiveProductRoutes);

// Safe HTML escape helper for email templates
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Generate styled HTML quotation confirmation email sent to Seller and Sales
function generateSupplyOfferQuotationEmailHtml(data) {
  const currencySymbol = data.currency === 'USD' ? '$' : (data.currency === 'EUR' ? '€' : (data.currency === 'AED' ? 'AED ' : '₹'));
  const safeOfferRef = escapeHtml(data.offerReference);
  const safeQuotationNo = escapeHtml(data.vendorQuotationNo);
  const safeRfqRef = escapeHtml(data.rfqReference);
  const safeVendorName = escapeHtml(data.vendorName);
  const safeContact = escapeHtml(data.contactPerson);
  const safeEmail = escapeHtml(data.vendorEmail);
  const safeMobile = escapeHtml(data.mobileNumber);
  const safeProduct = escapeHtml(data.productName);
  const safeCategory = escapeHtml(data.category);
  const safeGrade = escapeHtml(data.grade);
  const safeUom = escapeHtml(data.uom || 'MT');
  const safeDest = escapeHtml(data.destination);
  const safePackaging = escapeHtml(data.packagingType);
  const safeAvailability = escapeHtml(data.productAvailability);
  const safePriceBasis = escapeHtml(data.priceBasis);
  const safePaymentTerms = escapeHtml(data.paymentTerms);
  const safeRemarks = escapeHtml(data.commercialRemarks);
  const safeViewUrl = data.viewOfferUrl;

  const formattedUnitPrice = `${currencySymbol}${Number(data.offeredUnitPrice || 0).toLocaleString('en-IN')}`;
  const formattedOtherCharges = Number(data.otherCharges) > 0 ? `${currencySymbol}${Number(data.otherCharges).toLocaleString('en-IN')}/${safeUom}` : 'Nil';
  const effectiveUnitRate = Number(data.offeredUnitPrice || 0) + Number(data.otherCharges || 0);
  const formattedEffectivePrice = `${currencySymbol}${effectiveUnitRate.toLocaleString('en-IN')}`;
  const formattedBasic = `${currencySymbol}${Number(data.totalBasicAmount || 0).toLocaleString('en-IN')}`;
  const formattedGst = data.currency === 'INR' ? `${currencySymbol}${Number(data.gstAmount || 0).toLocaleString('en-IN')} (${escapeHtml(data.gstRate)})` : 'N/A';
  const formattedFreight = data.freightIncluded ? 'Included in Unit Price' : (Number(data.freightCharges) > 0 ? `${currencySymbol}${Number(data.freightCharges).toLocaleString('en-IN')}` : 'To be billed extra at actuals');
  const formattedGrandTotal = `${currencySymbol}${Number(data.estimatedTotalValue || 0).toLocaleString('en-IN')}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Quotation: ${safeOfferRef}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table width="680" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 32px; border-bottom: 3px solid #f97316;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td>
                        <span style="display: inline-block; background: #f97316; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
                          CollectiveBuy • Official Supply Offer
                        </span>
                        <h1 style="color: #ffffff; margin: 8px 0 2px 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px;">
                          Synergy5M Procurement Consortium
                        </h1>
                        <p style="color: #94a3b8; margin: 0; font-size: 12.5px;">
                          Demand Aggregation & Industrial B2B Sourcing
                        </p>
                      </td>
                      <td align="right" style="vertical-align: top;">
                        <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 8px 14px; text-align: right;">
                          <div style="color: #f97316; font-size: 11px; font-weight: 700;">OFFER REFERENCE</div>
                          <div style="color: #ffffff; font-size: 13.5px; font-weight: 800; font-family: monospace;">${safeOfferRef}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Quotation Meta Strip -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 14px 32px; border-bottom: 1px solid #e2e8f0;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 12px; color: #475569;">
                    <tr>
                      <td width="25%"><strong>Quote No:</strong> <span style="font-family: monospace; color: #0f172a;">${safeQuotationNo}</span></td>
                      <td width="25%"><strong>Date:</strong> ${escapeHtml(data.quotationDate)}</td>
                      <td width="25%"><strong>Validity:</strong> ${escapeHtml(data.quotationValidUntil)}</td>
                      <td width="25%"><strong>RFQ Ref:</strong> <span style="font-family: monospace; color: #ea580c;">${safeRfqRef}</span></td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Content Body -->
              <tr>
                <td style="padding: 28px 32px;">
                  
                  <h2 style="color: #0f172a; font-size: 18px; margin: 0 0 8px 0;">Official Commercial Quotation Details</h2>
                  <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
                    A formal supply quotation has been submitted by <strong>${safeVendorName}</strong> against RFQ <strong>${safeRfqRef}</strong>. Both the supplier and the Synergy5M procurement team have received this record.
                  </p>

                  <!-- 2-Column Vendor & Product Summary -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                    <tr>
                      <td width="48%" style="vertical-align: top; background: #fffaf5; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px;">
                        <div style="color: #ea580c; font-size: 11.5px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">
                          Supplier / Seller Details
                        </div>
                        <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${safeVendorName}</div>
                        <div style="font-size: 12.5px; color: #475569; margin-top: 3px;">Contact Person: ${safeContact}</div>
                        <div style="font-size: 12.5px; color: #0ea5e9; margin-top: 2px;">✉ ${safeEmail}</div>
                        <div style="font-size: 12.5px; color: #475569; margin-top: 2px;">📞 ${safeMobile}</div>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="vertical-align: top; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                        <div style="color: #16a34a; font-size: 11.5px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px;">
                          Product & Supply Scope
                        </div>
                        <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${safeProduct}</div>
                        <div style="font-size: 12.5px; color: #475569; margin-top: 3px;">Category / Grade: ${safeCategory} • ${safeGrade}</div>
                        <div style="font-size: 12.5px; color: #16a34a; font-weight: 700; margin-top: 2px;">
                          Offered Qty: ${data.offeredQuantity} ${safeUom} (${data.canSupplyFull ? 'Full Demand' : 'Partial Supply'})
                        </div>
                        <div style="font-size: 12.5px; color: #475569; margin-top: 2px;">Packaging: ${safePackaging} • ${safeAvailability}</div>
                      </td>
                    </tr>
                  </table>

                  <!-- Commercial Table -->
                  <div style="color: #0f172a; font-size: 13.5px; font-weight: 700; margin-bottom: 8px;">
                    💰 Commercial Valuation Breakdown
                  </div>
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 24px; font-size: 13px;">
                    <tr style="background: #0f172a; color: #ffffff;">
                      <th style="padding: 10px 14px; text-align: left; font-size: 12px;">Component</th>
                      <th style="padding: 10px 14px; text-align: right; font-size: 12px;">Rate / Parameter</th>
                      <th style="padding: 10px 14px; text-align: right; font-size: 12px;">Total Value</th>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                      <td style="padding: 10px 14px; font-weight: 600;">Offered Unit Price (${safePriceBasis})</td>
                      <td style="padding: 10px 14px; text-align: right; font-family: monospace;">${formattedUnitPrice} / ${safeUom}</td>
                      <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-family: monospace;">${formattedBasic}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                      <td style="padding: 10px 14px;">Platform Fee</td>
                      <td style="padding: 10px 14px; text-align: right; font-family: monospace;">${formattedOtherCharges}</td>
                      <td style="padding: 10px 14px; text-align: right; color: #64748b;">Included in Effective Rate</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                      <td style="padding: 10px 14px;">GST / Taxes (${escapeHtml(data.gstRate)})</td>
                      <td style="padding: 10px 14px; text-align: right;">${escapeHtml(data.gstRate)}</td>
                      <td style="padding: 10px 14px; text-align: right; font-family: monospace;">${formattedGst}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                      <td style="padding: 10px 14px;">Freight / Transportation</td>
                      <td style="padding: 10px 14px; text-align: right;">${data.freightIncluded ? 'Included' : 'Extra'}</td>
                      <td style="padding: 10px 14px; text-align: right; font-family: monospace;">${formattedFreight}</td>
                    </tr>
                    <tr style="background: #fff7ed; color: #ea580c; font-weight: 800; font-size: 14.5px;">
                      <td style="padding: 12px 14px;">Grand Estimated Valuation</td>
                      <td style="padding: 12px 14px; text-align: right; font-size: 12px; color: #64748b;">Effective: ${formattedEffectivePrice}/${safeUom}</td>
                      <td style="padding: 12px 14px; text-align: right; font-family: monospace; font-size: 16px;">${formattedGrandTotal}</td>
                    </tr>
                  </table>

                  <!-- Logistics & Payment Terms -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 12.5px;">
                    <tr>
                      <td width="50%" style="padding-bottom: 8px;">
                        <span style="color: #64748b;">Delivery Lead Time:</span> <strong>${escapeHtml(String(data.deliveryLeadTimeDays || '7-14'))} Days</strong>
                      </td>
                      <td width="50%" style="padding-bottom: 8px;">
                        <span style="color: #64748b;">Payment Terms:</span> <strong>${safePaymentTerms}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span style="color: #64748b;">Transport Scope:</span> <strong>${escapeHtml(data.transportationResponsibility)}</strong>
                      </td>
                      <td>
                        <span style="color: #64748b;">Destination:</span> <strong>${safeDest}</strong>
                      </td>
                    </tr>
                    ${safeRemarks ? `
                    <tr>
                      <td colspan="2" style="padding-top: 8px; border-top: 1px dashed #cbd5e1; color: #475569; font-style: italic;">
                        Remarks: "${safeRemarks}"
                      </td>
                    </tr>` : ''}
                  </table>

                  <!-- Action CTA Button -->
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align: center; margin-bottom: 24px;">
                    <tr>
                      <td>
                        <a href="${safeViewUrl}" target="_blank" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 14px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);">
                          📄 View Official Quotation & Print PDF
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Non-Liability Platform Disclaimer -->
                  <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; font-size: 11.5px; color: #92400e; line-height: 1.45;">
                    <strong>⚖️ Platform Notice & Non-Liability Clause:</strong>
                    Synergy5M operates strictly as a B2B demand pooling, aggregation, and facilitation technology platform. Synergy5M is not a contracting principal, buyer, reseller, or guarantor. Synergy5M shall not be liable for any direct, indirect, or consequential commercial or financial losses, default in payments, or delivery failure. All commercial agreements are executed directly between matched buyers and suppliers.
                  </div>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f1f5f9; padding: 18px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b;">
                  <div>Synergy5M LLP — B2B Collective Procurement Portal</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">Pune, Maharashtra, India • sales@synergy5m.com</div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// -------------------------------------------------------------
// Vendor Supply Offer Submission Endpoint -> SupplyOfffertbl
// -------------------------------------------------------------
app.post('/api/supply-offer/submit', publicFormLimiter, async (req, res) => {
  try {
    const body = req.body || {};

    // Server-Side Input Validation (Allow-list, length, format & range checks)
    if (!body.vendorQuotationNo || typeof body.vendorQuotationNo !== 'string' || body.vendorQuotationNo.trim().length === 0 || body.vendorQuotationNo.length > 100) {
      return res.status(400).json({ success: false, message: 'Valid Vendor Quotation Number is required (max 100 characters).' });
    }
    if (!body.vendorEmail || typeof body.vendorEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.vendorEmail) || body.vendorEmail.length > 255) {
      return res.status(400).json({ success: false, message: 'A valid email address is required (max 255 characters).' });
    }
    const numericOfferedQty = Number(body.offeredQuantity);
    if (isNaN(numericOfferedQty) || numericOfferedQty <= 0 || numericOfferedQty > 100000000) {
      return res.status(400).json({ success: false, message: 'Offered quantity must be a positive number up to 100,000,000.' });
    }
    const numericUnitPrice = Number(body.offeredUnitPrice);
    if (isNaN(numericUnitPrice) || numericUnitPrice <= 0 || numericUnitPrice > 1000000000) {
      return res.status(400).json({ success: false, message: 'Offered unit price must be a positive number up to 1,000,000,000.' });
    }
    const numericMoq = Number(body.moq);
    if (isNaN(numericMoq) || numericMoq < 0) {
      return res.status(400).json({ success: false, message: 'MOQ must be a non-negative number.' });
    }
    if (!body.declarationConfirmed || !body.platformDisclaimerConfirmed) {
      return res.status(400).json({ success: false, message: 'Declaration and acceptance of Synergy5M non-liability platform terms are required.' });
    }

    // Allow-list checks for enumerated selections
    const allowedCurrencies = ['INR', 'USD', 'EUR', 'AED', 'Other'];
    const safeCurrency = allowedCurrencies.includes(body.currency) ? body.currency : 'INR';

    const allowedPriceBases = ['FOR Destination', 'Ex-Works', 'FOB', 'CIF', 'Delivered'];
    const safePriceBasis = allowedPriceBases.includes(body.priceBasis) ? body.priceBasis : 'FOR Destination';

    const allowedGstRates = ['0%', '5%', '12%', '18%', '28%', 'Other', 'Not Applicable'];
    const safeGstRate = (safeCurrency === 'INR') ? (allowedGstRates.includes(body.gstRate) ? body.gstRate : '18%') : '0%';

    const allowedAvailabilities = ['Ready Stock', 'Made to Order'];
    const safeAvailability = allowedAvailabilities.includes(body.productAvailability) ? body.productAvailability : 'Ready Stock';

    const allowedSchedules = ['Single', 'Partial', 'Multiple'];
    const safeSchedule = allowedSchedules.includes(body.deliverySchedule) ? body.deliverySchedule : 'Single';
    const {
      offerReference,
      rfqReference,
      opportunityId,
      vendorQuotationNo,
      quotationDate,
      quotationValidUntil,
      vendorName,
      contactPerson,
      vendorEmail,
      mobileNumber,
      productName,
      category,
      grade,
      totalRequiredDemand,
      uom,
      destination,
      canSupplyFull,
      offeredQuantity,
      moq,
      maxSupplyCapacity,
      productAvailability,
      packagingType,
      offeredUnitPrice,
      currency,
      priceBasis,
      gstRate,
      gstAmount,
      freightIncluded,
      freightCharges,
      otherCharges,
      totalBasicAmount,
      estimatedTotalValue,
      deliveryLeadTimeDays,
      expectedDispatchDate,
      expectedDeliveryDate,
      deliverySchedule,
      transportationResponsibility,
      paymentTerms,
      advancePaymentPercentage,
      creditPeriodDays,
      enquiryAllocationsJson,
      staggeredScheduleJson,
      attachmentsJson,
      commercialRemarks,
      specialConditions,
      declarationConfirmed,
      status
    } = body;

    const pool = await poolPromise;
    if (pool) {
      try {
        const insertQuery = `
                    INSERT INTO [dbo].[SupplyOfffertbl] (
                        OfferReference, RfqReference, OpportunityId, VendorQuotationNo, QuotationDate, QuotationValidUntil,
                        VendorName, ContactPerson, VendorEmail, MobileNumber,
                        ProductName, Category, Grade, TotalRequiredDemand, Uom, Destination,
                        CanSupplyFull, OfferedQuantity, Moq, MaxSupplyCapacity, ProductAvailability, PackagingType,
                        OfferedUnitPrice, Currency, PriceBasis, GstRate, GstAmount, FreightIncluded, FreightCharges, OtherCharges,
                        TotalBasicAmount, EstimatedTotalValue,
                        DeliveryLeadTimeDays, ExpectedDispatchDate, ExpectedDeliveryDate, DeliverySchedule, TransportationResponsibility,
                        PaymentTerms, AdvancePaymentPercentage, CreditPeriodDays,
                        EnquiryAllocationsJson, StaggeredScheduleJson, AttachmentsJson,
                        CommercialRemarks, SpecialConditions, DeclarationConfirmed, Status, CreatedAt, UpdatedAt
                    ) VALUES (
                        @OfferReference, @RfqReference, @OpportunityId, @VendorQuotationNo, @QuotationDate, @QuotationValidUntil,
                        @VendorName, @ContactPerson, @VendorEmail, @MobileNumber,
                        @ProductName, @Category, @Grade, @TotalRequiredDemand, @Uom, @Destination,
                        @CanSupplyFull, @OfferedQuantity, @Moq, @MaxSupplyCapacity, @ProductAvailability, @PackagingType,
                        @OfferedUnitPrice, @Currency, @PriceBasis, @GstRate, @GstAmount, @FreightIncluded, @FreightCharges, @OtherCharges,
                        @TotalBasicAmount, @EstimatedTotalValue,
                        @DeliveryLeadTimeDays, @ExpectedDispatchDate, @ExpectedDeliveryDate, @DeliverySchedule, @TransportationResponsibility,
                        @PaymentTerms, @AdvancePaymentPercentage, @CreditPeriodDays,
                        @EnquiryAllocationsJson, @StaggeredScheduleJson, @AttachmentsJson,
                        @CommercialRemarks, @SpecialConditions, @DeclarationConfirmed, @Status, GETDATE(), GETDATE()
                    )
                `;

        const request = pool.request();
        request.input('OfferReference', sql.NVarChar(100), offerReference || `OFFER-CB-${Date.now()}`);
        request.input('RfqReference', sql.NVarChar(100), rfqReference || '');
        request.input('OpportunityId', sql.NVarChar(100), String(opportunityId || ''));
        request.input('VendorQuotationNo', sql.NVarChar(100), vendorQuotationNo || '');
        request.input('QuotationDate', sql.Date, quotationDate ? new Date(quotationDate) : new Date());
        request.input('QuotationValidUntil', sql.Date, quotationValidUntil ? new Date(quotationValidUntil) : new Date());
        request.input('VendorName', sql.NVarChar(255), vendorName || '');
        request.input('ContactPerson', sql.NVarChar(255), contactPerson || '');
        request.input('VendorEmail', sql.NVarChar(255), vendorEmail || '');
        request.input('MobileNumber', sql.NVarChar(50), mobileNumber || '');
        request.input('ProductName', sql.NVarChar(255), productName || '');
        request.input('Category', sql.NVarChar(255), category || '');
        request.input('Grade', sql.NVarChar(255), grade || '');
        request.input('TotalRequiredDemand', sql.Decimal(18, 2), Number(totalRequiredDemand) || 0);
        request.input('Uom', sql.NVarChar(50), uom || 'MT');
        request.input('Destination', sql.NVarChar(255), destination || '');
        request.input('CanSupplyFull', sql.Bit, canSupplyFull ? 1 : 0);
        request.input('OfferedQuantity', sql.Decimal(18, 2), Number(offeredQuantity) || 0);
        request.input('Moq', sql.Decimal(18, 2), Number(moq) || 1);
        request.input('MaxSupplyCapacity', sql.Decimal(18, 2), maxSupplyCapacity ? Number(maxSupplyCapacity) : null);
        request.input('ProductAvailability', sql.NVarChar(100), safeAvailability);
        request.input('PackagingType', sql.NVarChar(255), String(packagingType || '').slice(0, 255));
        request.input('OfferedUnitPrice', sql.Decimal(18, 2), numericUnitPrice);
        request.input('Currency', sql.NVarChar(20), safeCurrency);
        request.input('PriceBasis', sql.NVarChar(100), safePriceBasis);
        request.input('GstRate', sql.NVarChar(50), safeGstRate);
        request.input('GstAmount', sql.Decimal(18, 2), safeCurrency === 'INR' ? (Number(gstAmount) || 0) : 0);
        request.input('FreightIncluded', sql.Bit, freightIncluded ? 1 : 0);
        request.input('FreightCharges', sql.Decimal(18, 2), Number(freightCharges) || 0);
        request.input('OtherCharges', sql.Decimal(18, 2), Number(otherCharges) || 0);
        request.input('TotalBasicAmount', sql.Decimal(18, 2), Number(totalBasicAmount) || 0);
        request.input('EstimatedTotalValue', sql.Decimal(18, 2), Number(estimatedTotalValue) || 0);
        request.input('DeliveryLeadTimeDays', sql.Int, deliveryLeadTimeDays ? Number(deliveryLeadTimeDays) : null);
        request.input('ExpectedDispatchDate', sql.Date, expectedDispatchDate ? new Date(expectedDispatchDate) : null);
        request.input('ExpectedDeliveryDate', sql.Date, expectedDeliveryDate ? new Date(expectedDeliveryDate) : null);
        request.input('DeliverySchedule', sql.NVarChar(100), safeSchedule);
        request.input('TransportationResponsibility', sql.NVarChar(100), transportationResponsibility || 'Vendor');
        request.input('PaymentTerms', sql.NVarChar(255), paymentTerms || '');
        request.input('AdvancePaymentPercentage', sql.Decimal(5, 2), Number(advancePaymentPercentage) || 0);
        request.input('CreditPeriodDays', sql.Int, Number(creditPeriodDays) || 0);
        request.input('EnquiryAllocationsJson', sql.NVarChar(sql.MAX), typeof enquiryAllocationsJson === 'string' ? enquiryAllocationsJson : JSON.stringify(enquiryAllocationsJson || []));
        request.input('StaggeredScheduleJson', sql.NVarChar(sql.MAX), typeof staggeredScheduleJson === 'string' ? staggeredScheduleJson : JSON.stringify(staggeredScheduleJson || []));
        request.input('AttachmentsJson', sql.NVarChar(sql.MAX), typeof attachmentsJson === 'string' ? attachmentsJson : JSON.stringify(attachmentsJson || []));
        request.input('CommercialRemarks', sql.NVarChar(sql.MAX), commercialRemarks || '');
        request.input('SpecialConditions', sql.NVarChar(sql.MAX), specialConditions || '');
        request.input('DeclarationConfirmed', sql.Bit, (declarationConfirmed && body.platformDisclaimerConfirmed) ? 1 : 0);
        request.input('Status', sql.NVarChar(50), status || 'Quotation Received');

        await request.query(insertQuery);

        const finalOfferRef = offerReference || `OFFER-CB-${Date.now()}`;
        const appBaseUrl = process.env.APP_BASE_URL || (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'https://synergy5m.com');
        const viewOfferUrl = `${appBaseUrl}/supply-offer/view?offerRef=${encodeURIComponent(finalOfferRef)}`;
        const salesEmail = process.env.SALES_EMAIL || process.env.SMTP_USER || "sales@synergy5m.com";

        // Asynchronously dispatch quotation emails to both Vendor and Sales
        (async () => {
          try {
            const quotationEmailHtml = generateSupplyOfferQuotationEmailHtml({
              offerReference: finalOfferRef,
              rfqReference: rfqReference || 'N/A',
              vendorQuotationNo: vendorQuotationNo || 'N/A',
              quotationDate: quotationDate || new Date().toISOString().split('T')[0],
              quotationValidUntil: quotationValidUntil || '15 Days',
              vendorName: vendorName || 'Registered Vendor',
              contactPerson: contactPerson || 'N/A',
              vendorEmail: vendorEmail || '',
              mobileNumber: mobileNumber || 'N/A',
              productName: productName || 'Industrial Product',
              category: category || 'Industrial',
              grade: grade || 'Commercial Grade',
              totalRequiredDemand: totalRequiredDemand || 0,
              uom: uom || 'MT',
              destination: destination || 'As per RFQ',
              canSupplyFull: Boolean(canSupplyFull),
              offeredQuantity: numericOfferedQty,
              moq: numericMoq,
              packagingType: packagingType || 'Standard',
              productAvailability: safeAvailability,
              offeredUnitPrice: numericUnitPrice,
              currency: safeCurrency,
              priceBasis: safePriceBasis,
              gstRate: safeGstRate,
              gstAmount: safeCurrency === 'INR' ? (Number(gstAmount) || 0) : 0,
              freightIncluded: Boolean(freightIncluded),
              freightCharges: Number(freightCharges) || 0,
              otherCharges: Number(otherCharges) || 0,
              totalBasicAmount: Number(totalBasicAmount) || 0,
              estimatedTotalValue: Number(estimatedTotalValue) || 0,
              deliveryLeadTimeDays: deliveryLeadTimeDays || '7-14',
              expectedDispatchDate: expectedDispatchDate || 'As per schedule',
              expectedDeliveryDate: expectedDeliveryDate || 'As per schedule',
              deliverySchedule: safeSchedule,
              transportationResponsibility: transportationResponsibility || 'Supplier Scope',
              paymentTerms: paymentTerms || 'Standard Terms',
              advancePaymentPercentage: advancePaymentPercentage || 0,
              creditPeriodDays: creditPeriodDays || 0,
              commercialRemarks: commercialRemarks || '',
              viewOfferUrl
            });

            const emailTasks = [];

            // Dispatch ONLY to Seller / Vendor with Sales in CC (not vice versa)
            if (vendorEmail) {
              const sellerMailOpts = {
                from: `"Synergy5M Procurement Consortium" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
                to: vendorEmail,
                subject: `Quotation Confirmation: Supply Offer Submitted for ${productName} (${finalOfferRef})`,
                html: quotationEmailHtml
              };
              if (salesEmail && salesEmail.toLowerCase() !== vendorEmail.toLowerCase()) {
                sellerMailOpts.cc = salesEmail;
              }
              emailTasks.push({
                to: vendorEmail,
                mailOptions: sellerMailOpts
              });
            }

            dispatchEmailTasksInBackground(emailTasks);
          } catch (mailErr) {
            console.error("Supply offer email notification error:", mailErr.message);
          }
        })().catch(() => { });

        return res.json({
          success: true,
          offerReference: finalOfferRef,
          vendorQuotationNo,
          submittedAt: new Date().toISOString(),
          offeredQuantity,
          status: 'Quotation Received',
          viewOfferUrl,
          message: 'Offer successfully registered and confirmation emails dispatched.'
        });
      } catch (dbErr) {
        console.error("Database error saving to SupplyOfffertbl:", dbErr.message);
        return res.status(500).json({
          success: false,
          message: "An internal database error occurred while registering your offer. Please try again later."
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: 'Database connection pool unavailable.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error processing supply offer.' });
  }
});

// -------------------------------------------------------------
// GET /api/supply-offer/view/:offerRef - Fetch single specific supply offer
// -------------------------------------------------------------
app.get('/api/supply-offer/view/:offerRef', async (req, res) => {
  try {
    const rawRef = req.params.offerRef;
    if (!rawRef || typeof rawRef !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid Offer Reference is required.' });
    }

    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection unavailable.' });
    }

    const request = pool.request();
    request.input('OfferRef', sql.NVarChar(100), rawRef.trim());

    const result = await request.query(`
      SELECT TOP 1 *
      FROM [dbo].[SupplyOfffertbl]
      WHERE OfferReference = @OfferRef OR VendorQuotationNo = @OfferRef
      ORDER BY Id DESC;
    `);

    if (!result.recordset || result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found for the specified reference.' });
    }

    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("Error fetching single offer:", err.message);
    return res.status(500).json({ success: false, message: 'Server error retrieving quotation.' });
  }
});

// -------------------------------------------------------------
// GET /api/supply-offer/rfq-context - Retrieve live RFQ & product context for vendor offer submission
// -------------------------------------------------------------
app.get('/api/supply-offer/rfq-context', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection unavailable.' });
    }

    const { rfq, vendor, product, offerRef } = req.query;

    let rfqData = null;
    let prevOffer = null;
    let buyerBreakdown = [];

    // 1. If offerRef is provided, check SupplyOfffertbl
    if (offerRef && String(offerRef).trim()) {
      const qCheck = await pool.request()
        .input('OfferRef', sql.NVarChar(100), String(offerRef).trim())
        .query(`
          SELECT TOP 1 *
          FROM [dbo].[SupplyOfffertbl]
          WHERE OfferReference = @OfferRef OR VendorQuotationNo = @OfferRef
          ORDER BY Id DESC
        `);
      if (qCheck.recordset && qCheck.recordset.length > 0) {
        prevOffer = qCheck.recordset[0];
        rfqData = {
          rfqReference: prevOffer.RfqReference || rfq || '',
          opportunityId: prevOffer.OpportunityId || '',
          productName: prevOffer.ProductName || '',
          category: prevOffer.Category || '',
          grade: prevOffer.Grade || '',
          totalDemand: Number(prevOffer.TotalRequiredDemand || prevOffer.OfferedQuantity || 0),
          uom: prevOffer.Uom || 'MT',
          destination: prevOffer.Destination || '',
          vendorName: prevOffer.VendorName || vendor || '',
          vendorEmail: prevOffer.VendorEmail || '',
          contactPerson: prevOffer.ContactPerson || '',
          mobileNumber: prevOffer.MobileNumber || ''
        };
      }
    }

    // 2. If not found by offerRef or no offerRef, check SentSupplyOffers
    if (!rfqData && rfq && String(rfq).trim()) {
      const sentReq = pool.request();
      sentReq.input('RfqRef', sql.NVarChar(100), String(rfq).trim());

      let queryStr = `
        SELECT TOP 1 *
        FROM [dbo].[SentSupplyOffers]
        WHERE RfqReference = @RfqRef
      `;
      if (vendor && String(vendor).trim()) {
        sentReq.input('Vendor', sql.NVarChar(255), String(vendor).trim());
        queryStr += ` AND (LOWER(LTRIM(RTRIM(VendorName))) = LOWER(LTRIM(RTRIM(@Vendor))) OR LOWER(LTRIM(RTRIM(VendorEmail))) = LOWER(LTRIM(RTRIM(@Vendor))))`;
      }
      if (product && String(product).trim()) {
        sentReq.input('Product', sql.NVarChar(255), String(product).trim());
        queryStr += ` AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@Product)))`;
      }
      queryStr += ` ORDER BY Id DESC;`;

      const sentResult = await sentReq.query(queryStr);
      if (sentResult.recordset && sentResult.recordset.length > 0) {
        const s = sentResult.recordset[0];
        rfqData = {
          rfqReference: s.RfqReference,
          opportunityId: s.OpportunityId || '',
          productName: s.ProductName,
          category: s.Category || '',
          grade: s.Grade || '',
          totalDemand: Number(s.TotalDemand || 0),
          uom: s.Uom || 'MT',
          destination: s.Destination || '',
          vendorName: s.VendorName,
          vendorEmail: s.VendorEmail || '',
          buyerEnquiriesCount: s.BuyerEnquiriesCount || 1
        };
      }
    }

    // 3. If rfqData found, look up anonymous buyer breakdown
    if (rfqData && rfqData.productName) {
      try {
        const bReq = pool.request();
        bReq.input('Product', sql.NVarChar(255), rfqData.productName);
        const buyerRes = await bReq.query(`
          SELECT 
            ce.Id,
            ce.RequiredQuantity,
            ce.Uom,
            ce.DeliveryLocation
          FROM [dbo].[CollectiveEnquiries] ce
          WHERE LOWER(LTRIM(RTRIM(ce.ProductName))) = LOWER(LTRIM(RTRIM(@Product)))
            AND (ce.Status = 'Pooled' OR ce.Status = 'Approved' OR ce.Status = 'Verified' OR ce.Status IS NULL)
          ORDER BY ce.Id ASC
        `);
        if (buyerRes.recordset && buyerRes.recordset.length > 0) {
          buyerBreakdown = buyerRes.recordset.map((b, idx) => ({
            enquiryRef: `CE-${b.Id}`,
            buyerName: `Verified Buyer ${idx + 1} (${b.DeliveryLocation || rfqData.destination || 'Consortium'})`,
            requiredQty: Number(b.RequiredQuantity || 0),
            destination: b.DeliveryLocation || rfqData.destination || ''
          }));
        }
      } catch (beErr) {
        // Fallback gracefully
      }
    }

    // If still no breakdown but totalDemand > 0, provide single synthetic anonymous breakdown
    if (buyerBreakdown.length === 0 && rfqData && rfqData.totalDemand > 0) {
      buyerBreakdown = [
        {
          enquiryRef: `DEMAND-1`,
          buyerName: `Verified Consortium Demand (${rfqData.destination || 'India'})`,
          requiredQty: rfqData.totalDemand,
          destination: rfqData.destination || ''
        }
      ];
    }

    return res.json({
      success: true,
      rfqData,
      prevOffer,
      buyerBreakdown
    });
  } catch (err) {
    console.error("Error fetching RFQ context:", err.message);
    return res.status(500).json({ success: false, message: 'Server error retrieving RFQ context.' });
  }
});

// -------------------------------------------------------------
// GET /api/supply-offers/sent - Fetch all dispatched RFQ offers with submitted count
// -------------------------------------------------------------
app.get('/api/supply-offers/sent', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({ success: true, data: [] });
    }

    // Ensure SentSupplyOffers table exists
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SentSupplyOffers' AND xtype='U')
      CREATE TABLE [dbo].[SentSupplyOffers] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [RfqReference] NVARCHAR(100) NOT NULL,
          [OpportunityId] NVARCHAR(100) NULL,
          [VendorId] INT NULL,
          [VendorName] NVARCHAR(255) NOT NULL,
          [VendorEmail] NVARCHAR(255) NOT NULL,
          [ProductName] NVARCHAR(255) NOT NULL,
          [Category] NVARCHAR(255) NULL,
          [Grade] NVARCHAR(255) NULL,
          [TotalDemand] DECIMAL(18, 2) NOT NULL,
          [Uom] NVARCHAR(50) DEFAULT 'MT',
          [Destination] NVARCHAR(255) NULL,
          [BuyerEnquiriesCount] INT DEFAULT 1,
          [SubmitOfferUrl] NVARCHAR(MAX) NOT NULL,
          [Status] NVARCHAR(50) DEFAULT 'Sent',
          [SentAt] DATETIME DEFAULT GETDATE(),
          [CreatedAt] DATETIME DEFAULT GETDATE()
      );
    `);

    const result = await pool.request().query(`
      WITH DedupSent AS (
        SELECT 
          s.*,
          ROW_NUMBER() OVER (
            PARTITION BY s.RfqReference, LOWER(LTRIM(RTRIM(s.ProductName))), LOWER(LTRIM(RTRIM(s.VendorName)))
            ORDER BY s.SentAt DESC, s.Id DESC
          ) AS rn
        FROM [dbo].[SentSupplyOffers] s
      )
      SELECT 
        s.Id,
        s.RfqReference,
        s.OpportunityId,
        s.VendorId,
        s.VendorName,
        s.VendorEmail,
        s.ProductName,
        s.Category,
        s.Grade,
        s.TotalDemand,
        s.Uom,
        s.Destination,
        s.SubmitOfferUrl,
        s.Status AS SendStatus,
        s.SentAt,
        COUNT(o.Id) AS SubmittedOffersCount,
        latest.OfferReference AS LatestOfferRef,
        latest.VendorQuotationNo AS LatestQuotationNo,
        latest.OfferedUnitPrice AS LatestUnitPrice,
        latest.OfferedQuantity AS LatestOfferedQty,
        latest.EstimatedTotalValue AS LatestTotalValue,
        latest.Currency AS LatestCurrency,
        latest.CreatedAt AS LastSubmittedAt
      FROM DedupSent s
      LEFT JOIN [dbo].[SupplyOfffertbl] o 
        ON (s.RfqReference = o.RfqReference 
            AND LOWER(LTRIM(RTRIM(s.ProductName))) = LOWER(LTRIM(RTRIM(o.ProductName)))
            AND (
              LOWER(LTRIM(RTRIM(s.VendorName))) = LOWER(LTRIM(RTRIM(o.VendorName)))
              OR (LOWER(LTRIM(RTRIM(s.VendorEmail))) = LOWER(LTRIM(RTRIM(o.VendorEmail))) 
                  AND (s.VendorName IS NULL OR o.VendorName IS NULL OR s.VendorName = '' OR o.VendorName = ''))
            ))
      OUTER APPLY (
        SELECT TOP 1 
          sub.OfferReference,
          sub.VendorQuotationNo,
          sub.OfferedUnitPrice,
          sub.OfferedQuantity,
          sub.EstimatedTotalValue,
          sub.Currency,
          sub.CreatedAt
        FROM [dbo].[SupplyOfffertbl] sub
        WHERE sub.RfqReference = s.RfqReference
          AND LOWER(LTRIM(RTRIM(sub.ProductName))) = LOWER(LTRIM(RTRIM(s.ProductName)))
          AND (
            LOWER(LTRIM(RTRIM(s.VendorName))) = LOWER(LTRIM(RTRIM(sub.VendorName)))
            OR (LOWER(LTRIM(RTRIM(s.VendorEmail))) = LOWER(LTRIM(RTRIM(sub.VendorEmail))) 
                AND (s.VendorName IS NULL OR sub.VendorName IS NULL OR s.VendorName = '' OR sub.VendorName = ''))
          )
        ORDER BY sub.CreatedAt DESC, sub.Id DESC
      ) latest
      WHERE s.rn = 1
      GROUP BY 
        s.Id, s.RfqReference, s.OpportunityId, s.VendorId, s.VendorName, s.VendorEmail,
        s.ProductName, s.Category, s.Grade, s.TotalDemand, s.Uom, s.Destination,
        s.SubmitOfferUrl, s.Status, s.SentAt,
        latest.OfferReference, latest.VendorQuotationNo, latest.OfferedUnitPrice, latest.OfferedQuantity,
        latest.EstimatedTotalValue, latest.Currency, latest.CreatedAt
      ORDER BY s.SentAt DESC;
    `);

    const records = result.recordset || [];
    res.json({ success: true, data: records });
  } catch (err) {
    console.error("Error fetching sent supply offers:", err.message);
    res.status(500).json({ success: false, message: "Error fetching sent supply offers." });
  }
});

// -------------------------------------------------------------
// GET /api/supply-offers/submitted - Fetch all submitted quotations from SupplyOfffertbl
// -------------------------------------------------------------
app.get('/api/supply-offers/submitted', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.json({ success: true, data: [] });
    }

    const result = await pool.request().query(`
      SELECT 
        Id,
        OfferReference,
        RfqReference,
        OpportunityId,
        VendorQuotationNo,
        QuotationDate,
        QuotationValidUntil,
        VendorName,
        ContactPerson,
        VendorEmail,
        MobileNumber,
        ProductName,
        Category,
        Grade,
        TotalRequiredDemand,
        Uom,
        Destination,
        CanSupplyFull,
        OfferedQuantity,
        Moq,
        MaxSupplyCapacity,
        ProductAvailability,
        PackagingType,
        OfferedUnitPrice,
        Currency,
        PriceBasis,
        GstRate,
        GstAmount,
        FreightIncluded,
        FreightCharges,
        OtherCharges,
        TotalBasicAmount,
        EstimatedTotalValue,
        DeliveryLeadTimeDays,
        ExpectedDispatchDate,
        ExpectedDeliveryDate,
        DeliverySchedule,
        TransportationResponsibility,
        PaymentTerms,
        AdvancePaymentPercentage,
        CreditPeriodDays,
        EnquiryAllocationsJson,
        StaggeredScheduleJson,
        CommercialRemarks,
        SpecialConditions,
        Status,
        CreatedAt
      FROM [dbo].[SupplyOfffertbl]
      ORDER BY CreatedAt DESC;
    `);

    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    console.error("Error fetching submitted supply offers:", err.message);
    res.status(500).json({ success: false, message: "Error fetching submitted supply offers." });
  }
});

// -------------------------------------------------------------
// POST /api/supply-offers/evaluate - Step 5: Commercial Evaluation & Awarding
// Handles:
// - Option A: 'award' (Approve Quotation -> sets Status = 'Awarded', competing offers = 'Not Selected', SentSupplyOffers = 'Closed / Won')
// - Option B: 'counter-offer' (Request Price Revision -> sets Status = 'Under Negotiation', updates remarks, emails vendor)
// - Option C: 'multi-source-split' (Award %/MT volume across multiple vendors -> sets Status = 'Split Awarded', SentSupplyOffers = 'Closed / Won')
// - Option D: 'reset' (Reopens evaluation -> sets Status = 'Quotation Received', SentSupplyOffers = 'Sent')
// -------------------------------------------------------------
app.post('/api/supply-offers/evaluate', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(500).json({ success: false, message: 'Database connection unavailable.' });
    }

    const {
      action,
      offerRef,
      rfqReference,
      productName,
      counterUnitPrice,
      counterRemarks,
      splits,
      awardRemarks
    } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Evaluation action is required.' });
    }

    const salesEmail = process.env.SALES_EMAIL || process.env.SMTP_USER || "sales@synergy5m.com";
    const appBaseUrl = process.env.APP_BASE_URL || (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'https://synergy5m.com');

    // ---------------------------------------------------------
    // ACTION A: AWARD & APPROVE QUOTATION
    // ---------------------------------------------------------
    if (action === 'award') {
      if (!offerRef || !rfqReference || !productName) {
        return res.status(400).json({ success: false, message: 'offerRef, rfqReference, and productName are required to award.' });
      }

      // Fetch the winning quote details for email notification
      const winCheck = await pool.request()
        .input('OfferRef', sql.NVarChar(100), offerRef)
        .query(`SELECT TOP 1 * FROM [dbo].[SupplyOfffertbl] WHERE OfferReference = @OfferRef`);
      
      const winningQuote = winCheck.recordset[0];
      if (!winningQuote) {
        return res.status(404).json({ success: false, message: 'Selected quotation not found.' });
      }

      // 1. Mark selected offer as 'Awarded'
      const awardReq = pool.request();
      awardReq.input('OfferRef', sql.NVarChar(100), offerRef);
      awardReq.input('AwardRemarks', sql.NVarChar(sql.MAX), awardRemarks || '');
      await awardReq.query(`
        UPDATE [dbo].[SupplyOfffertbl]
        SET Status = 'Awarded',
            CommercialRemarks = CASE 
              WHEN @AwardRemarks IS NOT NULL AND LEN(LTRIM(RTRIM(@AwardRemarks))) > 0 
              THEN ISNULL(CommercialRemarks + CHAR(13) + CHAR(10), '') + '[AWARD CONFIRMED ' + CONVERT(NVARCHAR, GETDATE(), 120) + ']: ' + @AwardRemarks 
              ELSE CommercialRemarks 
            END,
            UpdatedAt = GETDATE()
        WHERE OfferReference = @OfferRef;
      `);

      // 2. Mark competing offers for this specific product under this RFQ as 'Not Selected'
      const compReq = pool.request();
      compReq.input('OfferRef', sql.NVarChar(100), offerRef);
      compReq.input('RfqRef', sql.NVarChar(100), rfqReference);
      compReq.input('ProdName', sql.NVarChar(255), productName);
      await compReq.query(`
        UPDATE [dbo].[SupplyOfffertbl]
        SET Status = 'Not Selected',
            UpdatedAt = GETDATE()
        WHERE RfqReference = @RfqRef
          AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)))
          AND OfferReference <> @OfferRef
          AND Status = 'Quotation Received';
      `);

      // 3. Mark SentSupplyOffers for this product as 'Closed / Won'
      const sentReq = pool.request();
      sentReq.input('RfqRef', sql.NVarChar(100), rfqReference);
      sentReq.input('ProdName', sql.NVarChar(255), productName);
      await sentReq.query(`
        UPDATE [dbo].[SentSupplyOffers]
        SET Status = 'Closed / Won'
        WHERE RfqReference = @RfqRef
          AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)));
      `);

      // Asynchronously send congratulations & award email to winning vendor
      if (winningQuote.VendorEmail) {
        (async () => {
          try {
            const viewDocUrl = `${appBaseUrl}/supply-offer/view?offerRef=${encodeURIComponent(offerRef)}`;
            const awardEmailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #0e7c86 0%, #065e66 100%); padding: 24px; color: #ffffff; text-align: center;">
                  <h2 style="margin: 0; font-size: 22px;">🎉 Quotation Award Notification</h2>
                  <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Synergy5M B2B Procurement Consortium</p>
                </div>
                <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                  <p>Dear <strong>${winningQuote.VendorName || 'Partner'}</strong>,</p>
                  <p>We are pleased to inform you that your quotation (<strong>#${winningQuote.VendorQuotationNo || offerRef}</strong>) for <strong>${productName}</strong> has been officially <strong>AWARDED & APPROVED</strong> by the Synergy5M Sourcing Committee.</p>
                  
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <h3 style="margin: 0 0 10px; color: #166534; font-size: 15px;">Awarded Commercial Summary:</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px;">
                      <li><strong>Product:</strong> ${productName} (${winningQuote.Grade || 'Standard'})</li>
                      <li><strong>Awarded Quantity:</strong> ${winningQuote.OfferedQuantity} ${winningQuote.Uom || 'MT'}</li>
                      <li><strong>Awarded Unit Price:</strong> ₹${Number(winningQuote.OfferedUnitPrice).toLocaleString('en-IN')}/${winningQuote.Uom || 'MT'}</li>
                      <li><strong>Estimated Total Value:</strong> ₹${Number(winningQuote.EstimatedTotalValue || 0).toLocaleString('en-IN')}</li>
                      <li><strong>RFQ Reference:</strong> ${rfqReference}</li>
                    </ul>
                  </div>

                  <p>Our operations team is now coordinating buyer quota allocations and escrow settlements. You will receive the official Master Purchase Order shortly.</p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${viewDocUrl}" style="background-color: #0e7c86; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">
                      📄 View Official Awarded Quotation
                    </a>
                  </div>
                </div>
              </div>
            `;

            const mailOpts = {
              from: `"Synergy5M Procurement Consortium" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
              to: winningQuote.VendorEmail,
              subject: `🎉 Award Notification: Your Supply Offer for ${productName} has been Selected! (${offerRef})`,
              html: awardEmailHtml
            };
            if (salesEmail && salesEmail.toLowerCase() !== winningQuote.VendorEmail.toLowerCase()) {
              mailOpts.cc = salesEmail;
            }
            dispatchEmailTasksInBackground([{ to: winningQuote.VendorEmail, mailOptions: mailOpts }]);
          } catch (mErr) {
            console.error("Award email error:", mErr.message);
          }
        })().catch(() => {});
      }

      return res.json({
        success: true,
        action: 'award',
        offerRef,
        message: `Quotation ${winningQuote.VendorQuotationNo || offerRef} has been officially awarded! Competing quotes marked as Not Selected and RFQ status updated to Closed / Won.`
      });
    }

    // ---------------------------------------------------------
    // ACTION B: REQUEST PRICE REVISION / COUNTER-OFFER
    // ---------------------------------------------------------
    if (action === 'counter-offer') {
      if (!offerRef || !counterUnitPrice) {
        return res.status(400).json({ success: false, message: 'offerRef and counterUnitPrice are required.' });
      }

      const qCheck = await pool.request()
        .input('OfferRef', sql.NVarChar(100), offerRef)
        .query(`SELECT TOP 1 * FROM [dbo].[SupplyOfffertbl] WHERE OfferReference = @OfferRef`);
      
      const quote = qCheck.recordset[0];
      if (!quote) {
        return res.status(404).json({ success: false, message: 'Quotation not found.' });
      }

      const noteText = `[COUNTER-OFFER ${new Date().toISOString().split('T')[0]}]: Proposed Rate: ₹${counterUnitPrice}/${quote.Uom || 'MT'} | Note: ${counterRemarks || 'Please review and confirm revised pricing.'}`;

      const revReq = pool.request();
      revReq.input('OfferRef', sql.NVarChar(100), offerRef);
      revReq.input('Note', sql.NVarChar(sql.MAX), noteText);
      await revReq.query(`
        UPDATE [dbo].[SupplyOfffertbl]
        SET Status = 'Under Negotiation',
            CommercialRemarks = ISNULL(CommercialRemarks + CHAR(13) + CHAR(10), '') + @Note,
            UpdatedAt = GETDATE()
        WHERE OfferReference = @OfferRef;
      `);

      // Asynchronously dispatch counter-offer / negotiation email
      if (quote.VendorEmail) {
        (async () => {
          try {
            const demandVal = quote.TotalRequiredDemand || quote.OfferedQuantity || 0;
            const reSubmitUrl = `${appBaseUrl}/vendor/supply-offer?mode=revise&rfq=${encodeURIComponent(quote.RfqReference)}&offerRef=${encodeURIComponent(quote.OfferReference)}&prodId=${encodeURIComponent(quote.OpportunityId || '')}&vendor=${encodeURIComponent(quote.VendorName)}&email=${encodeURIComponent(quote.VendorEmail || '')}&product=${encodeURIComponent(quote.ProductName)}&category=${encodeURIComponent(quote.Category || '')}&grade=${encodeURIComponent(quote.Grade || '')}&demand=${encodeURIComponent(demandVal)}&uom=${encodeURIComponent(quote.Uom || 'MT')}&dest=${encodeURIComponent(quote.Destination || '')}&counterRate=${encodeURIComponent(counterUnitPrice)}&prevRate=${encodeURIComponent(quote.OfferedUnitPrice || '')}`;
            const viewDocUrl = `${appBaseUrl}/supply-offer/view?offerRef=${encodeURIComponent(quote.OfferReference)}`;
            const counterHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px; color: #ffffff; text-align: center;">
                  <h2 style="margin: 0; font-size: 22px;">💬 Price Revision Request</h2>
                  <p style="margin: 6px 0 0; font-size: 14px; opacity: 0.9;">Synergy5M B2B Procurement Consortium</p>
                </div>
                <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
                  <p>Dear <strong>${quote.VendorName || 'Partner'}</strong>,</p>
                  <p>Thank you for submitting your quotation (<strong>#${quote.VendorQuotationNo || offerRef}</strong>) for <strong>${quote.ProductName}</strong>.</p>
                  <p>Your quotation is actively shortlisted for the aggregated consortium demand. However, to match the target budget and award the full pooled volume, we request your best price revision:</p>
                  
                  <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 20px 0;">
                    <ul style="margin: 0; padding-left: 20px; color: #c2410c; font-size: 14px;">
                      <li><strong>Product:</strong> ${quote.ProductName} (${quote.Grade || 'Standard'})</li>
                      <li><strong>Current Offered Rate:</strong> ₹${quote.OfferedUnitPrice}/${quote.Uom || 'MT'}</li>
                      <li><strong>Consortium Target Counter-Rate:</strong> <b style="font-size: 16px; color: #ea580c;">₹${counterUnitPrice}/${quote.Uom || 'MT'}</b></li>
                      <li><strong>Consortium Notes:</strong> ${counterRemarks || 'Immediate order placement upon confirmation.'}</li>
                    </ul>
                  </div>

                  <p>Please review your current quotation PDF document or submit your updated revised offer using the options below:</p>

                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${reSubmitUrl}" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; margin: 6px 8px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
                      🔄 Send Revised Quotation
                    </a>
                    <a href="${viewDocUrl}" target="_blank" style="background-color: #0e7c86; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; margin: 6px 8px; box-shadow: 0 4px 12px rgba(14, 124, 134, 0.3);">
                      📄 Open Quotation PDF
                    </a>
                  </div>
                </div>
              </div>
            `;

            const mailOpts = {
              from: `"Synergy5M Procurement Consortium" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
              to: quote.VendorEmail,
              subject: `Negotiation / Price Revision Request: Supply Offer for ${quote.ProductName} (${offerRef})`,
              html: counterHtml
            };
            if (salesEmail && salesEmail.toLowerCase() !== quote.VendorEmail.toLowerCase()) {
              mailOpts.cc = salesEmail;
            }
            dispatchEmailTasksInBackground([{ to: quote.VendorEmail, mailOptions: mailOpts }]);
          } catch (mErr) {
            console.error("Counter-offer email error:", mErr.message);
          }
        })().catch(() => {});
      }

      return res.json({
        success: true,
        action: 'counter-offer',
        offerRef,
        message: `Quotation marked 'Under Negotiation'. Price revision request (₹${counterUnitPrice}/${quote.Uom || 'MT'}) dispatched to vendor.`
      });
    }

    // ---------------------------------------------------------
    // ACTION C: MULTI-SOURCE SPLIT ALLOCATION
    // ---------------------------------------------------------
    if (action === 'multi-source-split') {
      if (!rfqReference || !productName || !Array.isArray(splits) || splits.length === 0) {
        return res.status(400).json({ success: false, message: 'rfqReference, productName, and splits array are required.' });
      }

      const splitRefs = splits.map(s => s.offerRef).filter(Boolean);
      for (const sp of splits) {
        if (!sp.offerRef) continue;
        const note = `[SPLIT ALLOCATION]: Awarded Split: ${sp.allocatedQty || ''} MT (${sp.splitPercent || ''}%) | Note: ${sp.remarks || ''}`;
        const sReq = pool.request();
        sReq.input('OfferRef', sql.NVarChar(100), sp.offerRef);
        sReq.input('Note', sql.NVarChar(sql.MAX), note);
        await sReq.query(`
          UPDATE [dbo].[SupplyOfffertbl]
          SET Status = 'Split Awarded',
              CommercialRemarks = ISNULL(CommercialRemarks + CHAR(13) + CHAR(10), '') + @Note,
              UpdatedAt = GETDATE()
          WHERE OfferReference = @OfferRef;
        `);
      }

      // Mark other non-split quotes as Not Selected
      const nonSplitReq = pool.request();
      nonSplitReq.input('RfqRef', sql.NVarChar(100), rfqReference);
      nonSplitReq.input('ProdName', sql.NVarChar(255), productName);
      splitRefs.forEach((ref, idx) => nonSplitReq.input(`sref_${idx}`, sql.NVarChar(100), ref));
      const notInClause = splitRefs.length > 0 ? `AND OfferReference NOT IN (${splitRefs.map((_, idx) => `@sref_${idx}`).join(', ')})` : '';

      await nonSplitReq.query(`
        UPDATE [dbo].[SupplyOfffertbl]
        SET Status = 'Not Selected',
            UpdatedAt = GETDATE()
        WHERE RfqReference = @RfqRef
          AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)))
          ${notInClause}
          AND Status = 'Quotation Received';
      `);

      // Update SentSupplyOffers to Closed / Won
      const sentReq = pool.request();
      sentReq.input('RfqRef', sql.NVarChar(100), rfqReference);
      sentReq.input('ProdName', sql.NVarChar(255), productName);
      await sentReq.query(`
        UPDATE [dbo].[SentSupplyOffers]
        SET Status = 'Closed / Won'
        WHERE RfqReference = @RfqRef
          AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)));
      `);

      return res.json({
        success: true,
        action: 'multi-source-split',
        message: `Multi-source split successfully awarded across ${splits.length} vendors! RFQ status set to Closed / Won.`
      });
    }

    // ---------------------------------------------------------
    // ACTION D: RESET EVALUATION STATUS
    // ---------------------------------------------------------
    if (action === 'reset') {
      if (!rfqReference || !productName) {
        return res.status(400).json({ success: false, message: 'rfqReference and productName are required to reset.' });
      }

      const resetReq = pool.request();
      resetReq.input('RfqRef', sql.NVarChar(100), rfqReference);
      resetReq.input('ProdName', sql.NVarChar(255), productName);
      await resetReq.query(`
        UPDATE [dbo].[SupplyOfffertbl]
        SET Status = 'Quotation Received',
            UpdatedAt = GETDATE()
        WHERE RfqReference = @RfqRef
          AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)));

        UPDATE [dbo].[SentSupplyOffers]
        SET Status = 'Sent'
        WHERE RfqReference = @RfqRef
          AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)));
      `);

      return res.json({
        success: true,
        action: 'reset',
        message: 'Evaluation status reset back to Quotation Received.'
      });
    }

    return res.status(400).json({ success: false, message: `Unknown evaluation action: ${action}` });
  } catch (err) {
    console.error("Error in supply-offers evaluate:", err.message);
    return res.status(500).json({ success: false, message: "Server error processing evaluation action." });
  }
});

// -------------------------------------------------------------
// STAGE 7: BUYER ALLOCATION ENGINE & BUYER-SPECIFIC OFFERS
// -------------------------------------------------------------

async function ensureBuyerAllocationsTable(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BuyerAllocations' AND xtype='U')
    CREATE TABLE [dbo].[BuyerAllocations] (
      [Id] INT IDENTITY(1,1) PRIMARY KEY,
      [AllocationRef] NVARCHAR(100) NOT NULL UNIQUE,
      [EnquiryId] INT NOT NULL,
      [OfferReference] NVARCHAR(100) NOT NULL,
      [RfqReference] NVARCHAR(100) NOT NULL,
      [OpportunityId] NVARCHAR(100) NULL,
      [ProductId] NVARCHAR(100) NULL,
      [ProductName] NVARCHAR(255) NOT NULL,
      [Category] NVARCHAR(255) NULL,
      [Grade] NVARCHAR(255) NULL,
      [BuyerCompanyName] NVARCHAR(255) NOT NULL,
      [BuyerContactPerson] NVARCHAR(255) NULL,
      [BuyerEmail] NVARCHAR(255) NOT NULL,
      [BuyerPhone] NVARCHAR(50) NULL,
      [DeliveryLocation] NVARCHAR(255) NULL,
      [Region] NVARCHAR(100) DEFAULT 'Domestic',
      [TotalPoolDemand] DECIMAL(18, 2) NOT NULL,
      [RequestedQuantity] DECIMAL(18, 2) NOT NULL,
      [AllocatedQuantity] DECIMAL(18, 2) NOT NULL,
      [Uom] NVARCHAR(50) DEFAULT 'MT',
      [OfferedUnitPrice] DECIMAL(18, 2) NOT NULL,
      [Currency] NVARCHAR(20) DEFAULT 'INR',
      [PriceBasis] NVARCHAR(100) DEFAULT 'FOR Destination',
      [FreightIncluded] BIT DEFAULT 1,
      [FreightCharges] DECIMAL(18, 2) DEFAULT 0,
      [GstRate] NVARCHAR(50) DEFAULT '18%',
      [GstAmount] DECIMAL(18, 2) DEFAULT 0,
      [OtherCharges] DECIMAL(18, 2) DEFAULT 0,
      [TotalBasicAmount] DECIMAL(18, 2) NOT NULL,
      [TotalEstimatedValue] DECIMAL(18, 2) NOT NULL,
      [DeliveryLeadTimeDays] INT NULL,
      [ExpectedDispatchDate] DATE NULL,
      [ExpectedDeliveryDate] DATE NULL,
      [DeliverySchedule] NVARCHAR(100) NULL,
      [TransportationResponsibility] NVARCHAR(100) NULL,
      [SupplierPaymentTerms] NVARCHAR(255) NULL,
      [AdvancePaymentPercentage] DECIMAL(5, 2) DEFAULT 0,
      [CreditPeriodDays] INT DEFAULT 0,
      [OfferValidityHours] INT DEFAULT 48,
      [OfferValidUntil] DATETIME NULL,
      [Status] NVARCHAR(50) DEFAULT 'Allocated',
      [BuyerRemarks] NVARCHAR(MAX) NULL,
      [OfferEmailSentAt] DATETIME NULL,
      [BuyerAcceptedAt] DATETIME NULL,
      [BuyerPoNumber] NVARCHAR(100) NULL,
      [BuyerPoFileUrl] NVARCHAR(MAX) NULL,
      [CreatedAt] DATETIME DEFAULT GETDATE(),
      [UpdatedAt] DATETIME DEFAULT GETDATE()
    );
  `);
}

// Generate or refresh buyer allocations for an awarded quote
app.post('/api/buyer-allocations/generate', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

    await ensureBuyerAllocationsTable(pool);

    const { offerRef, rfqReference, productName } = req.body;
    if (!rfqReference || !productName) {
      return res.status(400).json({ success: false, message: 'rfqReference and productName are required.' });
    }

    // 1. Fetch winning quote
    let quoteQuery = `
      SELECT TOP 1 * FROM [dbo].[SupplyOfffertbl]
      WHERE RfqReference = @RfqRef 
        AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)))
    `;
    if (offerRef) {
      quoteQuery += ` AND OfferReference = @OfferRef`;
    } else {
      quoteQuery += ` AND (Status = 'Awarded' OR Status = 'Split Awarded' OR Status = 'Quotation Received') ORDER BY CASE WHEN Status = 'Awarded' THEN 1 WHEN Status = 'Split Awarded' THEN 2 ELSE 3 END, CreatedAt DESC`;
    }

    const qReq = pool.request();
    qReq.input('RfqRef', sql.NVarChar(100), rfqReference);
    qReq.input('ProdName', sql.NVarChar(255), productName);
    if (offerRef) qReq.input('OfferRef', sql.NVarChar(100), offerRef);

    const qRes = await qReq.query(quoteQuery);
    const quote = qRes.recordset[0];

    if (!quote) {
      return res.status(404).json({ success: false, message: 'No quotation found to generate allocations from.' });
    }

    // 2. Fetch all participating buyer enquiries for this product
    const bReq = pool.request();
    bReq.input('ProdName', sql.NVarChar(255), productName);
    const bRes = await bReq.query(`
      SELECT ce.* 
      FROM [dbo].[CollectiveEnquiries] ce
      WHERE LOWER(LTRIM(RTRIM(ce.ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)))
        AND (ce.Status IS NULL OR ce.Status <> 'Cancelled')
      ORDER BY ce.Id ASC
    `);

    const enquiries = bRes.recordset || [];
    if (enquiries.length === 0) {
      return res.status(404).json({ success: false, message: `No buyer enquiries found for ${productName}.` });
    }

    const totalPoolDemand = enquiries.reduce((sum, e) => sum + (parseFloat(e.RequiredQuantity) || 0), 0) || 1;
    const offeredQuantity = parseFloat(quote.OfferedQuantity) || totalPoolDemand;
    const baseUnitPrice = parseFloat(quote.OfferedUnitPrice) || 0;
    const gstRateStr = String(quote.GstRate || '18%');
    const gstRateNum = parseFloat(gstRateStr.replace(/[^0-9.]/g, '')) || 18;
    const freightIncluded = Boolean(quote.FreightIncluded);
    const freightCharges = parseFloat(quote.FreightCharges) || 0;
    const otherCharges = parseFloat(quote.OtherCharges) || 0;

    // Roll Platform Fee into product unit price so the buyer pays full amount without seeing platform fee separated
    const platformFeePerUnit = offeredQuantity > 0 ? (otherCharges / offeredQuantity) : 0;
    const combinedUnitPrice = Math.round((baseUnitPrice + platformFeePerUnit) * 100) / 100;

    const allocationsGenerated = [];

    for (const enq of enquiries) {
      const reqQty = parseFloat(enq.RequiredQuantity) || 0;
      let allocatedQty = reqQty;
      if (offeredQuantity < totalPoolDemand && totalPoolDemand > 0) {
        allocatedQty = Math.round(((reqQty / totalPoolDemand) * offeredQuantity) * 100) / 100;
      }

      const totalBasic = Math.round(allocatedQty * combinedUnitPrice);
      const totalFreight = freightIncluded ? 0 : Math.round(freightCharges * allocatedQty);
      const totalGst = Math.round((totalBasic * gstRateNum) / 100);
      const totalEstimated = totalBasic + totalFreight + totalGst;

      const allocRef = `ALLOC-${new Date().getFullYear()}-${enq.Id.toString().padStart(4, '0')}-${quote.Id || Date.now().toString().slice(-4)}`;

      const insReq = pool.request();
      insReq.input('AllocationRef', sql.NVarChar(100), allocRef);
      insReq.input('EnquiryId', sql.Int, enq.Id);
      insReq.input('OfferReference', sql.NVarChar(100), quote.OfferReference);
      insReq.input('RfqReference', sql.NVarChar(100), rfqReference);
      insReq.input('OpportunityId', sql.NVarChar(100), quote.OpportunityId || enq.ProductId || '');
      insReq.input('ProductId', sql.NVarChar(100), enq.ProductId || '');
      insReq.input('ProductName', sql.NVarChar(255), productName);
      insReq.input('Category', sql.NVarChar(255), quote.Category || '');
      insReq.input('Grade', sql.NVarChar(255), quote.Grade || '');
      insReq.input('BuyerCompanyName', sql.NVarChar(255), enq.CompanyName || 'Valued Buyer');
      insReq.input('BuyerContactPerson', sql.NVarChar(255), enq.ContactPerson || '');
      insReq.input('BuyerEmail', sql.NVarChar(255), enq.Email || '');
      insReq.input('BuyerPhone', sql.NVarChar(50), enq.Phone || '');
      insReq.input('DeliveryLocation', sql.NVarChar(255), enq.DeliveryLocation || quote.Destination || '');
      insReq.input('Region', sql.NVarChar(100), enq.Region || 'Domestic');
      insReq.input('TotalPoolDemand', sql.Decimal(18, 2), totalPoolDemand);
      insReq.input('RequestedQuantity', sql.Decimal(18, 2), reqQty);
      insReq.input('AllocatedQuantity', sql.Decimal(18, 2), allocatedQty);
      insReq.input('Uom', sql.NVarChar(50), quote.Uom || enq.Uom || 'MT');
      insReq.input('OfferedUnitPrice', sql.Decimal(18, 2), combinedUnitPrice);
      insReq.input('Currency', sql.NVarChar(20), quote.Currency || 'INR');
      insReq.input('PriceBasis', sql.NVarChar(100), quote.PriceBasis || 'FOR Destination');
      insReq.input('FreightIncluded', sql.Bit, freightIncluded ? 1 : 0);
      insReq.input('FreightCharges', sql.Decimal(18, 2), freightCharges);
      insReq.input('GstRate', sql.NVarChar(50), gstRateStr);
      insReq.input('GstAmount', sql.Decimal(18, 2), totalGst);
      insReq.input('OtherCharges', sql.Decimal(18, 2), 0);
      insReq.input('TotalBasicAmount', sql.Decimal(18, 2), totalBasic);
      insReq.input('TotalEstimatedValue', sql.Decimal(18, 2), totalEstimated);
      insReq.input('DeliveryLeadTimeDays', sql.Int, quote.DeliveryLeadTimeDays ? Number(quote.DeliveryLeadTimeDays) : null);
      insReq.input('ExpectedDispatchDate', sql.Date, quote.ExpectedDispatchDate ? new Date(quote.ExpectedDispatchDate) : null);
      insReq.input('ExpectedDeliveryDate', sql.Date, quote.ExpectedDeliveryDate ? new Date(quote.ExpectedDeliveryDate) : null);
      insReq.input('DeliverySchedule', sql.NVarChar(100), quote.DeliverySchedule || 'As per Schedule');
      insReq.input('TransportationResponsibility', sql.NVarChar(100), quote.TransportationResponsibility || 'Supplier Scope');
      insReq.input('SupplierPaymentTerms', sql.NVarChar(255), quote.PaymentTerms || 'Standard Terms');
      insReq.input('AdvancePaymentPercentage', sql.Decimal(5, 2), Number(quote.AdvancePaymentPercentage) || 0);
      insReq.input('CreditPeriodDays', sql.Int, Number(quote.CreditPeriodDays) || 0);

      await insReq.query(`
        IF EXISTS (SELECT 1 FROM [dbo].[BuyerAllocations] WHERE EnquiryId = @EnquiryId AND RfqReference = @RfqReference)
        BEGIN
          UPDATE [dbo].[BuyerAllocations]
          SET OfferReference = @OfferReference,
              AllocatedQuantity = @AllocatedQuantity,
              OfferedUnitPrice = @OfferedUnitPrice,
              OtherCharges = @OtherCharges,
              GstAmount = @GstAmount,
              TotalBasicAmount = @TotalBasicAmount,
              TotalEstimatedValue = @TotalEstimatedValue,
              DeliveryLeadTimeDays = @DeliveryLeadTimeDays,
              ExpectedDispatchDate = @ExpectedDispatchDate,
              ExpectedDeliveryDate = @ExpectedDeliveryDate,
              SupplierPaymentTerms = @SupplierPaymentTerms,
              AdvancePaymentPercentage = @AdvancePaymentPercentage,
              CreditPeriodDays = @CreditPeriodDays,
              OfferValidUntil = DATEADD(hour, 48, GETDATE()),
              UpdatedAt = GETDATE()
          WHERE EnquiryId = @EnquiryId AND RfqReference = @RfqReference;
        END
        ELSE
        BEGIN
          INSERT INTO [dbo].[BuyerAllocations] (
            AllocationRef, EnquiryId, OfferReference, RfqReference, OpportunityId, ProductId,
            ProductName, Category, Grade, BuyerCompanyName, BuyerContactPerson, BuyerEmail,
            BuyerPhone, DeliveryLocation, Region, TotalPoolDemand, RequestedQuantity,
            AllocatedQuantity, Uom, OfferedUnitPrice, Currency, PriceBasis, FreightIncluded,
            FreightCharges, GstRate, GstAmount, OtherCharges, TotalBasicAmount, TotalEstimatedValue,
            DeliveryLeadTimeDays, ExpectedDispatchDate, ExpectedDeliveryDate, DeliverySchedule,
            TransportationResponsibility, SupplierPaymentTerms, AdvancePaymentPercentage,
            CreditPeriodDays, OfferValidityHours, OfferValidUntil, Status, CreatedAt, UpdatedAt
          ) VALUES (
            @AllocationRef, @EnquiryId, @OfferReference, @RfqReference, @OpportunityId, @ProductId,
            @ProductName, @Category, @Grade, @BuyerCompanyName, @BuyerContactPerson, @BuyerEmail,
            @BuyerPhone, @DeliveryLocation, @Region, @TotalPoolDemand, @RequestedQuantity,
            @AllocatedQuantity, @Uom, @OfferedUnitPrice, @Currency, @PriceBasis, @FreightIncluded,
            @FreightCharges, @GstRate, @GstAmount, @OtherCharges, @TotalBasicAmount, @TotalEstimatedValue,
            @DeliveryLeadTimeDays, @ExpectedDispatchDate, @ExpectedDeliveryDate, @DeliverySchedule,
            @TransportationResponsibility, @SupplierPaymentTerms, @AdvancePaymentPercentage,
            @CreditPeriodDays, 48, DATEADD(hour, 48, GETDATE()), 'Allocated', GETDATE(), GETDATE()
          );
        END
      `);

      allocationsGenerated.push({
        allocationRef: allocRef,
        buyerCompanyName: enq.CompanyName,
        buyerEmail: enq.Email,
        allocatedQuantity: allocatedQty,
        unitPrice: combinedUnitPrice,
        totalEstimated
      });
    }

    return res.json({
      success: true,
      message: `Successfully generated ${allocationsGenerated.length} buyer allocation records. Offers are in Allocated status. You can now click "Send Offer Email" for each buyer when ready.`,
      allocations: allocationsGenerated
    });
  } catch (err) {
    console.error('Error generating buyer allocations:', err);
    return res.status(500).json({ success: false, message: `Server error generating buyer allocations: ${err.message}` });
  }
});

// Fetch allocations for admin view
app.get('/api/buyer-allocations', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.json({ success: true, data: [] });

    await ensureBuyerAllocationsTable(pool);

    const { rfqReference, productName } = req.query;
    let query = `SELECT * FROM [dbo].[BuyerAllocations] WHERE 1=1`;
    const request = pool.request();

    if (rfqReference) {
      query += ` AND RfqReference = @RfqRef`;
      request.input('RfqRef', sql.NVarChar(100), rfqReference);
    }
    if (productName) {
      query += ` AND LOWER(LTRIM(RTRIM(ProductName))) = LOWER(LTRIM(RTRIM(@ProdName)))`;
      request.input('ProdName', sql.NVarChar(255), productName);
    }

    query += ` ORDER BY Id DESC`;
    const result = await request.query(query);

    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    console.error('Error fetching buyer allocations:', err.message);
    return res.status(500).json({ success: false, message: 'Server error fetching buyer allocations.' });
  }
});

// Fetch single buyer allocation for public/buyer offer view (STRICT PRIVACY: Seller info masked)
app.get('/api/buyer-allocations/view/:ref', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

    await ensureBuyerAllocationsTable(pool);

    const ref = req.params.ref;
    const request = pool.request();
    request.input('Ref', sql.NVarChar(100), ref);

    const result = await request.query(`
      SELECT 
        Id,
        AllocationRef,
        EnquiryId,
        RfqReference,
        ProductName,
        Category,
        Grade,
        BuyerCompanyName,
        BuyerContactPerson,
        DeliveryLocation,
        Region,
        TotalPoolDemand,
        RequestedQuantity,
        AllocatedQuantity,
        Uom,
        OfferedUnitPrice,
        Currency,
        PriceBasis,
        FreightIncluded,
        FreightCharges,
        GstRate,
        GstAmount,
        OtherCharges,
        TotalBasicAmount,
        TotalEstimatedValue,
        DeliveryLeadTimeDays,
        ExpectedDispatchDate,
        ExpectedDeliveryDate,
        DeliverySchedule,
        TransportationResponsibility,
        SupplierPaymentTerms,
        AdvancePaymentPercentage,
        CreditPeriodDays,
        OfferValidityHours,
        OfferValidUntil,
        Status,
        OfferEmailSentAt,
        BuyerAcceptedAt,
        BuyerRemarks,
        CreatedAt
      FROM [dbo].[BuyerAllocations]
      WHERE AllocationRef = @Ref OR CAST(Id AS NVARCHAR(50)) = @Ref
    `);

    const record = result.recordset[0];
    if (!record) {
      return res.status(404).json({ success: false, message: 'Allocation offer not found or link has expired.' });
    }

    // STRICT PRIVACY: Seller name is intentionally masked
    record.SourcingPartner = "Verified Synergy5M Consortium Partner";

    return res.json({ success: true, data: record });
  } catch (err) {
    console.error('Error fetching buyer offer view:', err.message);
    return res.status(500).json({ success: false, message: 'Server error loading offer details.' });
  }
});

// Dispatch offer email to buyer ONLY when triggered from UI click (NEVER automatically)
app.post('/api/buyer-allocations/send-email', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

    const { allocationRef } = req.body;
    if (!allocationRef) {
      return res.status(400).json({ success: false, message: 'allocationRef is required.' });
    }

    const request = pool.request();
    request.input('Ref', sql.NVarChar(100), allocationRef);
    const result = await request.query(`
      SELECT * FROM [dbo].[BuyerAllocations] WHERE AllocationRef = @Ref OR CAST(Id AS NVARCHAR(50)) = @Ref
    `);

    const alloc = result.recordset[0];
    if (!alloc) {
      return res.status(404).json({ success: false, message: 'Allocation record not found.' });
    }

    if (!alloc.BuyerEmail) {
      return res.status(400).json({ success: false, message: 'Buyer email address is missing for this allocation.' });
    }

    const appBaseUrl = 'https://synergy5m.com';
    const viewOfferUrl = `${appBaseUrl}/buyer/offer/${encodeURIComponent(alloc.AllocationRef)}`;
    const salesEmail = process.env.SALES_EMAIL || process.env.SMTP_USER || "sales@synergy5m.com";

    const unitPriceDisplay = alloc.Currency === 'USD' ? `$${alloc.OfferedUnitPrice}` : `₹${Number(alloc.OfferedUnitPrice).toLocaleString('en-IN')}`;
    const totalEstDisplay = alloc.Currency === 'USD' ? `$${alloc.TotalEstimatedValue}` : `₹${Number(alloc.TotalEstimatedValue).toLocaleString('en-IN')}`;

    // STRICT ANONYMITY: Seller details are completely masked
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Consortium Offer Ready: ${alloc.ProductName}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #fff7ed; font-family: 'Inter', Helvetica, Arial, sans-serif; color: #334155;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fff7ed; padding: 30px 0;">
          <tr>
            <td align="center">
              <table width="650" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(249, 115, 22, 0.08); border: 1px solid #fed7aa;">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0e7c86 0%, #065e66 100%); padding: 24px 30px; text-align: left;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="55" style="vertical-align: middle;">
                          <div style="width: 48px; height: 48px; background: #ffffff; border-radius: 8px; text-align: center; line-height: 48px; font-weight: 800; color: #0e7c86; font-size: 18px;">
                            S5
                          </div>
                        </td>
                        <td style="vertical-align: middle; padding-left: 14px;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">Synergy5M Consortium</h1>
                          <p style="color: #ccfbf1; margin: 2px 0 0 0; font-size: 12.5px;">B2B Collective Procurement & Sourcing</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 30px 40px;">
                    <div style="display: inline-block; background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; margin-bottom: 12px;">
                      🎉 Bulk Discount Secured
                    </div>
                    
                    <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 14px 0; font-weight: 700;">
                      Great News, ${alloc.BuyerCompanyName || alloc.BuyerContactPerson || 'Partner'}!
                    </h2>

                    <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                      Your purchase requirement for <strong>${alloc.ProductName}</strong> was aggregated with compatible industrial buyers in the Synergy5M Consortium pool (${alloc.TotalPoolDemand} ${alloc.Uom} total pooled demand).
                    </p>

                    <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                      We have secured an exclusive, audited factory bulk rate. Your allocated quota and pricing breakdown are ready for review:
                    </p>

                    <!-- Commercial Summary Card -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 20px;">
                          <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13.5px;">
                            <tr>
                              <td style="color: #64748b; width: 40%; font-weight: 600;">Product:</td>
                              <td style="color: #0f172a; font-weight: 700;">${alloc.ProductName} (${alloc.Grade || 'Standard Grade'})</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Your Allocated Volume:</td>
                              <td style="color: #047857; font-weight: 800; font-size: 15px;">${alloc.AllocatedQuantity} ${alloc.Uom}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Consortium Unit Rate:</td>
                              <td style="color: #0f172a; font-weight: 800; font-size: 16px;">${unitPriceDisplay} / ${alloc.Uom}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Freight Terms:</td>
                              <td style="color: #334155;">${alloc.FreightIncluded ? 'Freight Included in Rate (Door Delivery)' : `Freight Extra (+₹${alloc.FreightCharges}/${alloc.Uom})`}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">GST / Taxes:</td>
                              <td style="color: #334155;">+${alloc.GstRate} (₹${Number(alloc.GstAmount).toLocaleString('en-IN')})</td>
                            </tr>
                            <tr style="border-top: 1px solid #cbd5e1;">
                              <td style="color: #0f172a; font-weight: 700; padding-top: 10px;">Total Landed Order Value:</td>
                              <td style="color: #047857; font-weight: 800; font-size: 17px; padding-top: 10px;">${totalEstDisplay}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Payment Terms:</td>
                              <td style="color: #334155;">${alloc.SupplierPaymentTerms || 'Direct Supplier Terms'}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Turnaround / Lead Time:</td>
                              <td style="color: #334155;">${alloc.DeliveryLeadTimeDays ? `${alloc.DeliveryLeadTimeDays} Days` : 'Standard Ready Dispatch'}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b; font-weight: 600;">Delivery Destination:</td>
                              <td style="color: #334155;">📍 ${alloc.DeliveryLocation}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Validity Alert -->
                    <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; margin-bottom: 26px; font-size: 13px; color: #9a3412;">
                      ⏳ <strong>Validity Notice:</strong> This pooled bulk quotation rate is reserved for your account for <strong>48 Hours</strong>. Please review and confirm your allocation to secure your shipment lot.
                    </div>

                    <!-- CTA Button -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="text-align: center; margin-bottom: 24px;">
                      <tr>
                        <td>
                          <a href="${viewOfferUrl}" target="_blank" style="background: linear-gradient(135deg, #0e7c86 0%, #065e66 100%); color: #ffffff; padding: 14px 32px; font-size: 14.5px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(14, 124, 134, 0.35);">
                            👉 Review & Accept Allocation Offer
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                      Questions or need assistance? Reply to this email or reach us at <a href="mailto:sales@synergy5m.com" style="color: #0e7c86;">sales@synergy5m.com</a>.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 30px; text-align: center; font-size: 12px; color: #64748b;">
                    Synergy5M LLP • Pune, Maharashtra, India • <a href="https://synergy5m.com/" style="color: #0e7c86; text-decoration: none;">https://synergy5m.com/</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Synergy5M Procurement Consortium" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
      to: alloc.BuyerEmail,
      subject: `Consortium Offer Ready: ${alloc.ProductName} - Review Your Allocated Bulk Rate`,
      html: emailHtml
    };

    if (salesEmail && salesEmail.toLowerCase() !== alloc.BuyerEmail.toLowerCase()) {
      mailOptions.cc = salesEmail;
    }

    dispatchEmailTasksInBackground([{ to: alloc.BuyerEmail, mailOptions }]);

    const upReq = pool.request();
    upReq.input('Ref', sql.NVarChar(100), alloc.AllocationRef);
    await upReq.query(`
      UPDATE [dbo].[BuyerAllocations]
      SET Status = 'Offer Sent',
          OfferEmailSentAt = GETDATE(),
          OfferValidUntil = DATEADD(hour, 48, GETDATE()),
          UpdatedAt = GETDATE()
      WHERE AllocationRef = @Ref;
    `);

    return res.json({
      success: true,
      message: `Consortium offer email successfully dispatched to ${alloc.BuyerEmail}. 48-hour validity countdown started.`
    });
  } catch (err) {
    console.error('Error dispatching buyer offer email:', err.message);
    return res.status(500).json({ success: false, message: 'Server error sending buyer offer email.' });
  }
});

// Buyer acceptance or decline endpoint
app.post('/api/buyer-allocations/respond', async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

    const { allocationRef, response, remarks } = req.body;
    if (!allocationRef || !response) {
      return res.status(400).json({ success: false, message: 'allocationRef and response are required.' });
    }

    const newStatus = response === 'accept' ? 'Accepted' : 'Declined';
    const upReq = pool.request();
    upReq.input('Ref', sql.NVarChar(100), allocationRef);
    upReq.input('Status', sql.NVarChar(50), newStatus);
    upReq.input('Remarks', sql.NVarChar(sql.MAX), remarks || '');

    await upReq.query(`
      UPDATE [dbo].[BuyerAllocations]
      SET Status = @Status,
          BuyerRemarks = @Remarks,
          BuyerAcceptedAt = CASE WHEN @Status = 'Accepted' THEN GETDATE() ELSE BuyerAcceptedAt END,
          UpdatedAt = GETDATE()
      WHERE AllocationRef = @Ref;
    `);

    return res.json({
      success: true,
      status: newStatus,
      message: newStatus === 'Accepted'
        ? 'Thank you! Your allocation acceptance has been recorded. Please proceed to issue your official Purchase Order.'
        : 'Your response has been recorded.'
    });
  } catch (err) {
    console.error('Error responding to buyer allocation:', err.message);
    return res.status(500).json({ success: false, message: 'Server error recording response.' });
  }
});

// -------------------------------------------------------------
// Static Frontend Catch-All Handler (MUST BE AT THE VERY BOTTOM)
// -------------------------------------------------------------

const buildPath = path.join(__dirname, "build");
const indexHtmlPath = path.join(buildPath, "index.html");

if (fs.existsSync(indexHtmlPath)) {
  app.use(
    express.static(buildPath, {
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    })
  );

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: `API endpoint ${req.path} not found` });
    }
    res.sendFile(indexHtmlPath);
  });
} else {
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: `API endpoint ${req.path} not found` });
    }
    res.status(503).send(`
      <div style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
        <h2>Synergy5M Server Running</h2>
        <p>Frontend bundle not detected in <code>${buildPath}</code>.</p>
      </div>
    `);
  });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Production server successfully listening on ${PORT}`);
});