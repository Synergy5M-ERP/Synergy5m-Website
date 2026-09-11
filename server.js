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
        from: `"Synergy5M ERP System" <${process.env.SMTP_USER || "mmm@synergy5m.com"}>`,
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
        from: `"Synergy5M ERP System" <${process.env.SMTP_USER || "mmm@synergy5m.com"}>`,
        to: ["sales@synergy5m.com", "accounts@synergy5m.com"],
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

  // console.log("Admin Login Attempt:", {
  //   received: { user: inputUser, pass: inputPass },
  //   expected: { user: adminUser, pass: adminPass },
  //   match: inputUser === adminUser && inputPass === adminPass,
  // });

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
// 3. Approve Action
// --- APPROVE ACTION ---
// app.post("/api/admin/approve", async (req, res) => {
//   const { id, type, email, recipientName } = req.body;
//   if (!id || !type || !email) {
//     return res.status(400).json({ success: false, message: "Missing required approval params" });
//   }

//   const generatedPassword = generatePassword(10);
//   const userRole = type === "erp" ? "erp" : "buying-selling";
//   const portalUrl = type === "erp" 
//     ? (process.env.ERP_LOGIN_URL || "https://synergy5m-Buyer_Seller_Portal-platform.azurewebsites.net/Login/Login")
//     : (process.env.B4P_LOGIN_URL || "https://synergy5m-Buyer_Seller_Portal-platform.azurewebsites.net/Login/Login");

//   try {
//     const pool = await poolPromise;
//     const transaction = new sql.Transaction(pool);
//     await transaction.begin();

//     try {
//       // 1. Insert into HRM_UserTbl and retrieve the new ID
//       const insertUserSql = `
//         INSERT INTO [dbo].[HRM_UserTbl] (
//           [username], [password], [AdminApprove], [StartDate],
//           [NoOfDays], [EndDate], [IsSubscribed], [CHIEF_ADMIN], [SUPERADMIN],
//           [DEPUTY_SUPERADMIN], [ADMIN], [DEPUTY_ADMIN], [USER], [UserRole],
//           [MaterialManagement], [SalesAndMarketing], [HRAndAdmin], [AccountAndFinance],
//           [Masters], [Dashboard], [ProductionAndQuality], [External_buyer_seller],
//           [Emp_Code], [Power_Of_Authority], [NewAssignModule], [NOT_APPLICABLE], [IsActive]
//         ) 
//         OUTPUT INSERTED.id
//         VALUES (
//           @Username, @Password, 1, GETDATE(),
//           30, DATEADD(day, 30, GETDATE()), 1, 0, 0,
//           0, 0, 0, 1, @UserRole,
//           0, 0, 0, 0,
//           0, 1, 0, ${type === "buyingselling" || type === "buying-selling" ? 1 : 0},
//           'EMP' + RIGHT('0000' + CAST(ABS(CHECKSUM(NEWID())) % 10000 AS VARCHAR(10)), 4), 
//           'User', 0, 0, 1
//         );
//       `;

//       const userResult = await transaction.request()
//         .input("Username", sql.NVarChar(150), email.trim().toLowerCase())
//         .input("Password", sql.NVarChar(100), generatedPassword)
//         .input("UserRole", sql.NVarChar(50), userRole)
//         .query(insertUserSql);

//       const newUserId = userResult.recordset[0]?.id;
//       if (!newUserId) {
//         throw new Error("Failed to retrieve generated UserId from HRM_UserTbl.");
//       }

//       // 2. Insert assigned modules into HRM_UserDetail based on type
//       const isErp = type === "erp";
//       const moduleFilterCondition = isErp 
//         ? "WHERE [ModuleCode] <> 'BuySell' AND [IsActive] = 1" 
//         : "WHERE [ModuleCode] = 'BuySell' AND [IsActive] = 1";

//       const insertUserDetailsSql = `
//         INSERT INTO [dbo].[HRM_UserDetail] (
//           [UserId],
//           [ModuleId],
//           [IsTransferred],
//           [IsActive]
//         )
//         SELECT 
//           @UserId,
//           [ModuleId],
//           0,
//           1
//         FROM [dbo].[HRM_ModuleMaster]
//         ${moduleFilterCondition};
//       `;

//       await transaction.request()
//         .input("UserId", sql.Int, newUserId)
//         .query(insertUserDetailsSql);

//       // 3. Update status in source table
//       if (isErp) {
//         await transaction.request()
//           .input("Id", sql.Int, id)
//           .query(`UPDATE [dbo].[TrialRequests] SET TrialStatus = 'Approved' WHERE Id = @Id;`);
//       } else {
//         await transaction.request()
//           .input("Id", sql.Int, id)
//           .query(`UPDATE [dbo].[BusinessEnquiries] SET Status = 'Approved', UpdatedAt = GETDATE() WHERE Id = @Id;`);
//       }

//       await transaction.commit();
//     } catch (err) {
//       await transaction.rollback();
//       throw err;
//     }

//     // 4. Send Credentials Email
//     const isErp = type === "erp";

// const mailHtml = `
//   <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff; margin: 0 auto;">
//     <h2 style="color: #0b5ed7; margin-top: 0;">Account Approved - Synergy 5M LLP</h2>
    
//     <p style="font-size: 14px; line-height: 1.5;">Dear <strong>${recipientName || "Valued Partner"}</strong>,</p>
    
//     <p style="font-size: 14px; line-height: 1.5;">
//       Your request for <strong>${isErp ? "SYN ERP 10" : "Buyer-Seller Portal"}</strong> has been officially approved. Your login credentials are ready:
//     </p>

//     <div style="background: #f7f9fa; border-left: 4px solid #0b5ed7; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
//       <p style="margin: 0 0 8px 0; font-size: 13.5px;">
//         <strong>Login URL:</strong> 
//         <a href="${portalUrl}" target="_blank" style="color: #0b5ed7; text-decoration: underline;">${portalUrl}</a>
//       </p>
//       <p style="margin: 0 0 8px 0; font-size: 13.5px;">
//         <strong>Username / Email:</strong> ${email.trim()}
//       </p>
//       <p style="margin: 0; font-size: 13.5px;">
//         <strong>Temporary Password:</strong> 
//         <span style="font-family: monospace; font-size: 15px; background: #ffffff; padding: 3px 8px; border: 1px solid #ccd0d4; border-radius: 4px; font-weight: 600;">${generatedPassword}</span>
//       </p>
//     </div>

//     <p style="color: #666; font-size: 13px; margin: 0 0 20px 0;">
//       * Please change your password upon your initial login for security purposes.
//     </p>

//     ${
//       isErp
//         ? `
//         <div style="margin-top: 24px; padding: 16px; background-color: #f0f7ff; border: 1px dashed #0b5ed7; border-radius: 6px;">
//           <h4 style="margin: 0 0 6px 0; color: #0b5ed7; font-size: 14px;">Did you know? Synergy 5M also features a Buyer-Seller Portal</h4>
//           <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #444;">
//             Alongside your ERP suite, you can list raw materials, post product requirements, and connect directly with verified industrial manufacturers across India on our <strong>Buyer-Seller Portal</strong>.
//           </p>
//           <p style="margin: 0; font-size: 12.5px; color: #555;">
//             Trade features can be enabled directly from your user profile or by reaching out to our support team.
//           </p>
//         </div>
//         `
//         : `
//         <div style="margin-top: 24px; padding: 16px; background-color: #fcf9f2; border: 1px dashed #d97706; border-radius: 6px;">
//           <h4 style="margin: 0 0 6px 0; color: #b45309; font-size: 14px;">Streamline Factory Operations with SYN ERP 10</h4>
//           <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #444;">
//             In addition to trading, Synergy 5M offers <strong>SYN ERP 10</strong>—an industrial ERP engineered for end-to-end plant operations covering Material Management, Production, Quality, Sales, and Accounting.
//           </p>
//           <p style="margin: 0; font-size: 13px; font-weight: 600; color: #b45309;">
//             Interested in end-to-end plant control? You can activate a <strong>30-Day Free Trial</strong> of SYN ERP 10 anytime by replying to this email.
//           </p>
//         </div>
//         `
//     }

//     <p style="margin-top: 24px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 14px;">
//       This is an automated notification from Synergy 5M LLP. If you have questions, reach out to our team at 
//       <a href="mailto:support@synergy5m.com" style="color: #0b5ed7;">support@synergy5m.com</a>.
//     </p>
//   </div>
// `;

//     try {
//       await transporter.sendMail({
//         from: `"Synergy5M Approvals" <${process.env.SMTP_USER || "mmm@synergy5m.com"}>`,
//         to: email.trim(),
//         subject: `Your Account has been Approved - ${type === "erp" ? "SYN ERP 10" : "Buyer_Seller_Portal"}`,
//         html: mailHtml,
//       });
//     } catch (mailErr) {
//       console.warn("Mail dispatch error on approve:", mailErr.message);
//     }

//     return res.json({ success: true, message: "Record approved, account created, and email sent successfully!" });
//   } catch (error) {
//     console.error("Approve endpoint error:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// });


app.post("/api/admin/approve", async (req, res) => {
  const { id, type, email, recipientName } = req.body;
  if (!id || !type || !email) {
    return res.status(400).json({ success: false, message: "Missing required approval params" });
  }

  const generatedPassword = generatePassword(10);
  const userRole = type === "erp" ? "erp" : "buying-selling";
  const portalUrl = type === "erp" 
    ? (process.env.ERP_LOGIN_URL || "https://synergy5m-Buyer_Seller_Portal-platform.azurewebsites.net/Login/Login")
    : (process.env.B4P_LOGIN_URL || "https://synergy5m-Buyer_Seller_Portal-platform.azurewebsites.net/Login/Login");

  try {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Insert into HRM_UserTbl and retrieve the new ID
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
          30, DATEADD(day, 30, GETDATE()), 1, 0, 0,
          0, 0, 0, 1, @UserRole,
          0, 0, 0, 0,
          0, 1, 0, ${type === "buyingselling" || type === "buying-selling" ? 1 : 0},
          'EMP' + RIGHT('0000' + CAST(ABS(CHECKSUM(NEWID())) % 10000 AS VARCHAR(10)), 4), 
          'User', 0, 0, 1
        );
      `;

      const userResult = await transaction.request()
        .input("Username", sql.NVarChar(150), email.trim().toLowerCase())
        .input("Password", sql.NVarChar(100), generatedPassword)
        .input("UserRole", sql.NVarChar(50), userRole)
        .query(insertUserSql);

      const newUserId = userResult.recordset[0]?.id;
      if (!newUserId) {
        throw new Error("Failed to retrieve generated UserId from HRM_UserTbl.");
      }

      // 2. Insert assigned modules into HRM_UserDetail based on type
      const isErp = type === "erp";
      const moduleFilterCondition = isErp 
        ? "WHERE [ModuleCode] <> 'BuySell' AND [IsActive] = 1" 
        : "WHERE [ModuleCode] = 'BuySell' AND [IsActive] = 1";

      const insertUserDetailsSql = `
        INSERT INTO [dbo].[HRM_UserDetail] (
          [UserId],
          [ModuleId],
          [IsTransferred],
          [IsActive]
        )
        SELECT 
          @UserId,
          [ModuleId],
          0,
          1
        FROM [dbo].[HRM_ModuleMaster]
        ${moduleFilterCondition};
      `;

      await transaction.request()
        .input("UserId", sql.Int, newUserId)
        .query(insertUserDetailsSql);

      // 3. Insert assigned menus into HRM_UserMenuDetail from MenuMasterTbl
      const menuFilterCondition = isErp
        ? "WHERE [MenuCode] NOT LIKE 'BuySell%' AND [IsActive] = 1"
        : "WHERE [MenuCode] LIKE 'BuySell%' AND [IsActive] = 1";

      const insertUserMenuDetailsSql = `
        INSERT INTO [dbo].[HRM_UserMenuDetail] (
          [UserId],
          [ModuleId],
          [MenuId],
          [SubMenuId],
          [IsActive],
          [IsTransferred]
        )
        SELECT 
          @UserId,
          [ModuleId],
          [MenuId],
          NULL,
          1,
          0
        FROM [dbo].[MenuMasterTbl]
        ${menuFilterCondition};
      `;

      await transaction.request()
        .input("UserId", sql.Int, newUserId)
        .query(insertUserMenuDetailsSql);

      // 4. Update status in source table
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

    // 5. Send Credentials Email
    const isErp = type === "erp";

    const mailHtml = `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 600px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background-color: #ffffff; margin: 0 auto;">
        <h2 style="color: #0b5ed7; margin-top: 0;">Account Approved - Synergy 5M LLP</h2>
        
        <p style="font-size: 14px; line-height: 1.5;">Dear <strong>${recipientName || "Valued Partner"}</strong>,</p>
        
        <p style="font-size: 14px; line-height: 1.5;">
          Your request for <strong>${isErp ? "SYN ERP 10" : "Buyer-Seller Portal"}</strong> has been officially approved. Your login credentials are ready:
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
              <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #444;">
                Alongside your ERP suite, you can list raw materials, post product requirements, and connect directly with verified industrial manufacturers across India on our <strong>Buyer-Seller Portal</strong>.
              </p>
              <p style="margin: 0; font-size: 12.5px; color: #555;">
                Trade features can be enabled directly from your user profile or by reaching out to our support team.
              </p>
            </div>
            `
            : `
            <div style="margin-top: 24px; padding: 16px; background-color: #fcf9f2; border: 1px dashed #d97706; border-radius: 6px;">
              <h4 style="margin: 0 0 6px 0; color: #b45309; font-size: 14px;">Streamline Factory Operations with SYN ERP 10</h4>
              <p style="margin: 0 0 10px 0; font-size: 13px; line-height: 1.5; color: #444;">
                In addition to trading, Synergy 5M offers <strong>SYN ERP 10</strong>—an industrial ERP engineered for end-to-end plant operations covering Material Management, Production, Quality, Sales, and Accounting.
              </p>
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #b45309;">
                Interested in end-to-end plant control? You can activate a <strong>30-Day Free Trial</strong> of SYN ERP 10 anytime by replying to this email.
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
        from: `"Synergy5M Approvals" <${process.env.SMTP_USER || "mmm@synergy5m.com"}>`,
        to: email.trim(),
        subject: `Your Account has been Approved - ${type === "erp" ? "SYN ERP 10" : "Buyer_Seller_Portal"}`,
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
// 4. Reject Action
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
        from: `"Synergy5M Verification Desk" <${process.env.SMTP_USER || "mmm@synergy5m.com"}>`,
        to: email.trim(),
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