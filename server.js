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
require("dotenv").config();

const { sql, poolPromise } = require("./db");

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Email Transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

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
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/\s+/g, "_")}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

app.use("/uploads", express.static(uploadDir));

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
app.get("/api/check-email", async (req, res) => {
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
      return res.json(["BUY", "SELL", "TRADING", "SEMIFINISH", "SERVICES", "JOBWORK"]);
    }

    const result = await pool.request().query(`
      SELECT DISTINCT LTRIM(RTRIM([ItemCategory])) AS Category
      FROM [dbo].[MASTER_ItemTbl]
      WHERE [ItemCategory] IS NOT NULL AND LTRIM(RTRIM([ItemCategory])) <> ''
      ORDER BY Category ASC
    `);

    const categories = result.recordset.map((row) => row.Category).filter(Boolean);
    return res.json(categories.length > 0 ? categories : ["BUY", "SELL", "TRADING", "SEMIFINISH", "SERVICES", "JOBWORK"]);
  } catch (err) {
    console.warn("Categories fetch fallback:", err.message);
    return res.json(["BUY", "SELL", "TRADING", "SEMIFINISH", "SERVICES", "JOBWORK"]);
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
      return res.json(["Standard Product A", "Standard Product B"]);
    }

    const request = pool.request();
    let query = `
      SELECT DISTINCT LTRIM(RTRIM([Item_Name])) AS Item_Name
      FROM [dbo].[MASTER_ItemTbl]
      WHERE [Item_Name] IS NOT NULL 
        AND LTRIM(RTRIM([Item_Name])) <> ''
    `;

    if (category && category !== "Other / Add New") {
      request.input("category", sql.NVarChar, category.trim());
      query += ` AND (
        UPPER(LTRIM(RTRIM(ISNULL([Item_Category], '')))) = UPPER(@category)
        OR UPPER(LTRIM(RTRIM(ISNULL([ItemCategory], '')))) = UPPER(@category)
      )`;
    }

    query += ` ORDER BY Item_Name ASC`;

    const result = await request.query(query);
    return res.json(result.recordset.map((row) => row.Item_Name));
  } catch (err) {
    console.warn("Products fetch error:", err.message);
    return res.json(["Standard Product A", "Standard Product B"]);
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

app.post("/api/inquiries", async (req, res) => {
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

app.post("/api/business-connect", uploadFields, async (req, res) => {
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

app.post("/api/demo-request", async (req, res) => {
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

app.post("/api/trial-request", async (req, res) => {
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

// 1. Admin Login (No JWT)
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  const inputUser = (username || "").trim();
  const inputPass = (password || "").trim();
  const adminUser = (process.env.ADMIN_USER || "admin").trim();
  const adminPass = (process.env.ADMIN_PASSWORD || "admin123").trim();

  if (inputUser === adminUser && inputPass === adminPass) {
    return res.json({
      success: true,
      message: "Login successful",
      user: adminUser,
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials",
  });
});

// 2. Fetch Paginated Data for ERP or Buying/Selling
app.get("/api/admin/enquiries", async (req, res) => {
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

app.post("/api/admin/approve", async (req, res) => {
  const { id, type, email, recipientName } = req.body;
  if (!id || !type || !email) {
    return res.status(400).json({ success: false, message: "Missing required approval params" });
  }

  const generatedPassword = generatePassword(10);
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
        .input("Password", sql.NVarChar(100), generatedPassword)
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

        ${
          isErp
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

app.post("/api/admin/reject", async (req, res) => {
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
app.get('/api/admin/demo-requests', async (req, res) => {
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
app.post('/api/admin/demo-requests/:id/approve', async (req, res) => {
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
app.post('/api/admin/demo-requests/:id/feedback', async (req, res) => {
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
app.get('/api/buying', async (req, res) => {
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
app.get('/api/selling', async (req, res) => {
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
app.get('/api/potential-vendors', async (req, res) => {
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
// Helper function for professional HTML email structure


 // If using ES modules / React, or use require in Node.js: 

const generateStyledEmailHtml = (recipientName, enquiryTitle, detailsHtml, isBuyerLead) => {
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
                                    ${isBuyerLead 
                                        ? `We have identified a new purchase requirement matching your business profile and product category. Please review the specifications below and submit your competitive quotation.`
                                        : `We have an active product offering available in your category. Please review the offer specifications below if interested in procurement.`
                                    }
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
                                            <a href="https://synergy5m-business-4-profit-platform.azurewebsites.net/" target="_blank" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; padding: 13px 26px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.35); margin-right: 12px;">
                                                🚀 View & Respond Now
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
app.post('/api/send-enquiry-email', async (req, res) => {
    const { buyerEnqIds, sellerEnqIds, vendorIds, mode } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: "Database connection not available" });

        // Mode 1: Send Buying Enquiries to Selected Vendors
        if (mode === 'vendor-buying' && buyerEnqIds && vendorIds) {
            for (const bId of buyerEnqIds) {
                const bRes = await pool.request().input('id', sql.Int, bId)
                    .query(`SELECT b.*, u.username as UserEmail FROM [dbo].[BuyingEnquiryTbl] b LEFT JOIN [dbo].[HRM_UserTbl] u ON b.UID = u.id WHERE b.Id = @id`);
                
                if (bRes.recordset.length === 0) continue;
                const buyer = bRes.recordset[0];

                for (const vId of vendorIds) {
                    const vRes = await pool.request().input('id', sql.Int, vId)
                        .query(`SELECT * FROM [dbo].[Potential_Vendor] WHERE Id = @id`);
                    
                    if (vRes.recordset.length === 0) continue;
                    const vendor = vRes.recordset[0];

                    if (vendor.Email) {
                        const detailsRows = `
                            <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Enquiry No:</td><td style="color: #1e293b; font-weight: 700;">${buyer.EnqNo || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Product Name:</td><td style="color: #1e293b; font-weight: 700;">${buyer.ProdName}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${buyer.ProdCat || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Grade / Specs:</td><td style="color: #334155;">${buyer.Grade || 'Standard'}</td></tr>
                             <tr><td style="color: #ea580c; font-weight: 600;">HSN:</td><td style="color: #334155;">${buyer.HSN || 'Standard'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Payment Terms:</td><td style="color: #334155;">${buyer.PayTerms || 'Standard'}</td></tr>

                            <tr><td style="color: #ea580c; font-weight: 600;">Required Qty:</td><td style="color: #ea580c; font-weight: 700;">${buyer.ReqQty} ${buyer.UOM}</td></tr>

                            <tr><td style="color: #ea580c; font-weight: 600;">Delivery Location and Expected Date:</td><td style="color: #334155;">${buyer.DelLoc || 'CIF'} (${buyer.ReqDelDate || 'Domestic'})</td></tr>
                           <tr><td style="color: #ea580c; font-weight: 600;">Region:</td><td style="color: #334155;">${buyer.DomImport || 'Standard'}</td></tr>
                           <tr><td style="color: #ea580c; font-weight: 600;">Enquiry Valid Till:</td><td style="color: #334155;">${buyer.EnqValDate || 'Standard'}</td></tr>


                        `;

                        const mailHtml = generateStyledEmailHtml(
                            vendor.Contact_Person || vendor.Company_Name, 
                            'Purchase Requirement Inquiry', 
                            detailsRows, 
                            true
                        );

                        const mailOptions = {
                            from: process.env.SMTP_USER || "sales@synergy5m.com",
                            to: vendor.Email,
                            cc: [buyer.UserEmail].filter(Boolean),
                            subject: `New Buy Lead: ${buyer.ProdName} (${buyer.ReqQty} ${buyer.UOM})`,
                            html: mailHtml
                        };
                        await transporter.sendMail(mailOptions);
                    }
                }
            }
            return res.json({ success: true, message: "Buying enquiries successfully sent to selected vendors!" });
        }

        // Mode 2: Send Selling Enquiries to Selected Vendors
        if (mode === 'vendor-selling' && sellerEnqIds && vendorIds) {
            for (const sId of sellerEnqIds) {
                const sRes = await pool.request().input('id', sql.Int, sId)
                    .query(`SELECT s.*, u.username as UserEmail FROM [dbo].[SellingEnquiryTbl] s LEFT JOIN [dbo].[HRM_UserTbl] u ON s.UID = u.id WHERE s.Id = @id`);
                
                if (sRes.recordset.length === 0) continue;
                const seller = sRes.recordset[0];

                for (const vId of vendorIds) {
                    const vRes = await pool.request().input('id', sql.Int, vId)
                        .query(`SELECT * FROM [dbo].[Potential_Vendor] WHERE Id = @id`);
                    
                    if (vRes.recordset.length === 0) continue;
                    const vendor = vRes.recordset[0];

                    if (vendor.Email) {
                        const detailsRows = `
                            <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Offer No:</td><td style="color: #1e293b; font-weight: 700;">${seller.OfferNo || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Product Name:</td><td style="color: #1e293b; font-weight: 700;">${seller.ProdName}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${seller.ItemCat || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Grade:</td><td style="color: #334155;">${seller.Grade || 'Standard'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Quantity Offered:</td><td style="color: #ea580c; font-weight: 700;">${seller.QuantityOffered} ${seller.UOM}</td></tr>
                               `;

                        const mailHtml = generateStyledEmailHtml(
                            vendor.Contact_Person || vendor.Company_Name, 
                            'Product Offering Notice', 
                            detailsRows, 
                            false
                        );

                        const mailOptions = {
                            from: process.env.SMTP_USER || "sales@synergy5m.com",
                            to: vendor.Email,
                            cc: [seller.UserEmail].filter(Boolean),
                            subject: `New Selling Offer: ${seller.ProdName} (${seller.QuantityOffered} ${seller.UOM})`,
                            html: mailHtml
                        };
                        await transporter.sendMail(mailOptions);
                    }
                }
            }
            return res.json({ success: true, message: "Selling offers successfully sent to selected vendors!" });
        }

        return res.status(400).json({ error: "Invalid mode or parameters provided." });
    } catch (err) {
        console.error("Email dispatch error:", err);
        res.status(500).json({ error: err.message });
    }
});
// Combined Email Dispatcher for Buying/Selling Enquiries to Potential Vendors
app.post('/api/send-enquiry-email', async (req, res) => {
    const { buyerEnqIds, sellerEnqIds, vendorIds, mode } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) return res.status(500).json({ error: "Database connection not available" });

        // Safely check if the local logo file exists on disk
        const logoFilePath = path.join(__dirname, 'uploads', 'synergy-logo.png');
        const hasLogo = fs.existsSync(logoFilePath);

        const emailAttachments = hasLogo ? [{
            filename: 'logo.png',
            path: logoFilePath,
            cid: 'synergylogo'
        }] : [];

        // Mode 1: Send Buying Enquiries to Selected Vendors
        if (mode === 'vendor-buying' && buyerEnqIds && vendorIds) {
            for (const bId of buyerEnqIds) {
                const bRes = await pool.request().input('id', sql.Int, bId)
                    .query(`SELECT b.*, u.username as UserEmail FROM [dbo].[BuyingEnquiryTbl] b LEFT JOIN [dbo].[HRM_UserTbl] u ON b.UID = u.id WHERE b.Id = @id`);
                
                if (bRes.recordset.length === 0) continue;
                const buyer = bRes.recordset[0];

                for (const vId of vendorIds) {
                    const vRes = await pool.request().input('id', sql.Int, vId)
                        .query(`SELECT * FROM [dbo].[Potential_Vendor] WHERE Id = @id`);
                    
                    if (vRes.recordset.length === 0) continue;
                    const vendor = vRes.recordset[0];

                    if (vendor.Email) {
                        const detailsRows = `
                            <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Enquiry No:</td><td style="color: #1e293b; font-weight: 700;">${buyer.EnqNo || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Product Name:</td><td style="color: #1e293b; font-weight: 700;">${buyer.ProdName}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${buyer.ProdCat || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Grade / Specs:</td><td style="color: #334155;">${buyer.Grade || 'Standard'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Required Qty:</td><td style="color: #ea580c; font-weight: 700;">${buyer.ReqQty} ${buyer.UOM}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Target Price:</td><td style="color: #334155;">${buyer.TgtPrice || 'Negotiable'} ${buyer.Currency || ''}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Incoterm / Location:</td><td style="color: #334155;">${buyer.Incoterm || 'CIF'} (${buyer.DelLoc || 'Domestic'})</td></tr>
                        `;

                        const mailHtml = generateStyledEmailHtml(
                            vendor.Contact_Person || vendor.Company_Name, 
                            'Purchase Requirement Inquiry', 
                            detailsRows, 
                            true
                        );

                        const mailOptions = {
                            from: process.env.SMTP_USER || "sales@synergy5m.com",
                            to: vendor.Email,
                            cc: [buyer.UserEmail].filter(Boolean),
                            subject: `New Buy Lead: ${buyer.ProdName} (${buyer.ReqQty} ${buyer.UOM})`,
                            html: mailHtml,
                            attachments: emailAttachments
                        };
                        await transporter.sendMail(mailOptions);
                    }
                }
            }
            return res.json({ success: true, message: "Buying enquiries successfully sent to selected vendors!" });
        }

        // Mode 2: Send Selling Enquiries to Selected Vendors
        if (mode === 'vendor-selling' && sellerEnqIds && vendorIds) {
            for (const sId of sellerEnqIds) {
                const sRes = await pool.request().input('id', sql.Int, sId)
                    .query(`SELECT s.*, u.username as UserEmail FROM [dbo].[SellingEnquiryTbl] s LEFT JOIN [dbo].[HRM_UserTbl] u ON s.UID = u.id WHERE s.Id = @id`);
                
                if (sRes.recordset.length === 0) continue;
                const seller = sRes.recordset[0];

                for (const vId of vendorIds) {
                    const vRes = await pool.request().input('id', sql.Int, vId)
                        .query(`SELECT * FROM [dbo].[Potential_Vendor] WHERE Id = @id`);
                    
                    if (vRes.recordset.length === 0) continue;
                    const vendor = vRes.recordset[0];

                    if (vendor.Email) {
                        const detailsRows = `
                            <tr><td style="color: #ea580c; width: 35%; font-weight: 600;">Offer No:</td><td style="color: #1e293b; font-weight: 700;">${seller.OfferNo || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Product Name:</td><td style="color: #1e293b; font-weight: 700;">${seller.ProdName}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Category:</td><td style="color: #334155;">${seller.ItemCat || 'N/A'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Grade:</td><td style="color: #334155;">${seller.Grade || 'Standard'}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Quantity Offered:</td><td style="color: #ea580c; font-weight: 700;">${seller.QuantityOffered} ${seller.UOM}</td></tr>
                            <tr><td style="color: #ea580c; font-weight: 600;">Price Per Unit:</td><td style="color: #334155;">${seller.PricePerUnit} ${seller.Currency}</td></tr>
                        `;

                        const mailHtml = generateStyledEmailHtml(
                            vendor.Contact_Person || vendor.Company_Name, 
                            'Product Offering Notice', 
                            detailsRows, 
                            false
                        );

                        const mailOptions = {
                            from: process.env.SMTP_USER || "sales@synergy5m.com",
                            to: vendor.Email,
                            cc: [seller.UserEmail].filter(Boolean),
                            subject: `New Selling Offer: ${seller.ProdName} (${seller.QuantityOffered} ${seller.UOM})`,
                            html: mailHtml,
                            attachments: emailAttachments
                        };
                        await transporter.sendMail(mailOptions);
                    }
                }
            }
            return res.json({ success: true, message: "Selling offers successfully sent to selected vendors!" });
        }

        return res.status(400).json({ error: "Invalid mode or parameters provided." });
    } catch (err) {
        console.error("Email dispatch error:", err);
        res.status(500).json({ error: err.message });
    }
});
const vendorRoutes = require('./vendorRoutes'); 
app.use('/', vendorRoutes);
const WhatsappRoute = require('./WhatsappRoute');
app.use('/whatsapp', WhatsappRoute);

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