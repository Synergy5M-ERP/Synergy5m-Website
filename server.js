const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { sql, poolPromise } = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname.replace(/\s+/g, "_")}`);
  },
});
const upload = multer({ storage });

// Serve static uploaded files
app.use("/uploads", express.static(uploadDir));

// Helper to generate sequential code (B-2026-00001 or S-2026-00001)
const generateCode = async (pool, category) => {
  const prefix = (category || "").toLowerCase() === "seller" ? "S" : "B";
  const result = await pool
    .request()
    .input("Prefix", sql.NVarChar(5), `${prefix}-%`)
    .query(`
      SELECT COUNT(1) AS Total 
      FROM dbo.BusinessEnquiries WITH (NOLOCK) 
      WHERE Code LIKE @Prefix
    `);

  const nextSeq = (result.recordset[0].Total + 1).toString().padStart(5, "0");
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${nextSeq}`;
};

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. General Inquiries
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
    await pool
      .request()
      .input("FullName", sql.NVarChar(150), String(fullName || "").trim())
      .input("BusinessEmail", sql.NVarChar(150), String(businessEmail || "").trim())
      .input("CompanyName", sql.NVarChar(200), String(companyName || "").trim())
      .input("OfficialMobile", sql.NVarChar(50), String(officialMobile || "").trim())
      .input("InterestedIn", sql.NVarChar(100), String(interestedIn || "General Inquiry").trim())
      .input("Requirement", sql.NVarChar(sql.MAX), requirement ? String(requirement).trim() : null)
      .query(`
        INSERT INTO dbo.Inquiries (Id, FullName, BusinessEmail, CompanyName, OfficialMobile, InterestedIn, Requirement)
        VALUES (
          (SELECT ISNULL(MAX(Id), 0) + 1 FROM dbo.Inquiries WITH (TABLOCKX)),
          @FullName, @BusinessEmail, @CompanyName, @OfficialMobile, @InterestedIn, @Requirement
        )
      `);

    return res.status(201).json({ success: true, message: "Your inquiry has been submitted successfully." });
  } catch (error) {
    console.error("❌ Error saving inquiry:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Unified Buyer & Seller Registration (Single Table: BusinessEnquiries)
const uploadFields = upload.fields([
  { name: "attachment", maxCount: 1 },
  { name: "documents", maxCount: 10 },
]);

app.post("/api/business-connect", uploadFields, async (req, res) => {
  try {
    const d = req.body;
    const pool = await poolPromise;

    const category = (d.category || "").toLowerCase() === "seller" ? "Seller" : "Buyer";
    const prefix = category === "Seller" ? "S" : "B";

    // Handle file uploads
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

    const query = `
      -- 1. Auto-generate next integer Id
      DECLARE @NextId INT;
      SELECT @NextId = ISNULL(MAX(Id), 0) + 1 
      FROM dbo.BusinessEnquiries WITH (TABLOCKX, HOLDLOCK);

      -- 2. Auto-generate next alphanumeric Code (e.g., B00001, S00001)
      DECLARE @NextNum INT;
      DECLARE @PrefixPattern NVARCHAR(10) = '${prefix}%';

      SELECT @NextNum = ISNULL(MAX(CAST(SUBSTRING(Code, 2, LEN(Code)) AS INT)), 0) + 1
      FROM dbo.BusinessEnquiries WITH (TABLOCKX, HOLDLOCK)
      WHERE Code LIKE @PrefixPattern
        AND ISNUMERIC(SUBSTRING(Code, 2, LEN(Code))) = 1;

      DECLARE @GeneratedCode NVARCHAR(50) = '${prefix}' + RIGHT('00000' + CAST(@NextNum AS NVARCHAR(10)), 5);

      -- 3. Insert both computed Id and Code
      INSERT INTO dbo.BusinessEnquiries (
        Id, Code, Category,
        CompanyName, GSTIN, CIN, Address, Website, CompanyEmail, Mobile, Industry, CompanyType, YearsInBusiness,
        RepresentativeName, Role, RepresentativeEmail, RepresentativeMobile,
        ProductName, ProductCategory, GradeModel, Application, TechnicalSpecification, HSNCode,
        RequiredQuantity, Unit, RequirementFrequency, DeliveryLocation, RequiredDeliveryDate,
        ManufacturerSupplier, ProductionCapacity, MOQ, LeadTime,
        PriceOrRange, Currency, PaymentTerms,
        CommissionType, ProposedCommission, CommissionApplicableOn,
        AttachmentPath
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
        @AttachmentPath
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
  } catch (error) {
    console.error("❌ Error saving BusinessEnquiry:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});



// POST /api/demo-request
// POST /api/demo-request
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

    // 1. Validation checks
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

    // 2. Prevent past dates
    const selectedDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return res.status(400).json({
        success: false,
        message: "Preferred demo date cannot be in the past.",
      });
    }

    // 3. Connect to pool & insert into DemoRequests table
    const pool = await poolPromise;

    const query = `
      -- Auto-generate next integer Id if identity is not set
      DECLARE @NextId INT;
      SELECT @NextId = ISNULL(MAX(Id), 0) + 1 
      FROM dbo.DemoRequests WITH (TABLOCKX, HOLDLOCK);

      INSERT INTO dbo.DemoRequests (
        Id,
        FullName,
        BusinessEmail,
        CompanyName,
        OfficialMobile,
        PreferredDate,
        TimeSlot,
        MeetingPlatform,
        Requirement,
        Status,
        CreatedAt
      )
      OUTPUT INSERTED.Id
      VALUES (
        @NextId,
        @FullName,
        @BusinessEmail,
        @CompanyName,
        @OfficialMobile,
        @PreferredDate,
        @TimeSlot,
        @MeetingPlatform,
        @Requirement,
        'Scheduled',
        GETUTCDATE()
      );
    `;

    const result = await pool
      .request()
      .input("FullName", sql.NVarChar(150), String(fullName).trim())
      .input("BusinessEmail", sql.NVarChar(150), String(businessEmail).trim().toLowerCase())
      .input("CompanyName", sql.NVarChar(200), String(companyName).trim())
      .input("OfficialMobile", sql.NVarChar(50), String(officialMobile).trim())
      .input("PreferredDate", sql.Date, new Date(preferredDate))
      .input("TimeSlot", sql.NVarChar(50), String(timeSlot).trim())
      .input("MeetingPlatform", sql.NVarChar(50), String(meetingPlatform).trim())
      .input("Requirement", sql.NVarChar(sql.MAX), requirement ? String(requirement).trim() : null)
      .query(query);

    const insertedId = result.recordset[0]?.Id;

    return res.status(201).json({
      success: true,
      id: insertedId,
      message: "Demo request confirmed! Our team will send the meeting invitation shortly.",
    });
  } catch (error) {
    console.error("❌ Error saving DemoRequest:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error while processing demo request.",
    });
  }
});
// -------------------------------------------------------------
// Safe Static Files / SPA Fallback (Express 5 Compatible)
// -------------------------------------------------------------
const buildPath = path.join(__dirname, "build");
const indexHtmlPath = path.join(buildPath, "index.html");

if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(buildPath));
  // Express 5 named wildcard syntax
  app.get("{*path}", (req, res) => {
    res.sendFile(indexHtmlPath);
  });
} else {
  app.get("/", (req, res) => {
    res.send("Synergy5M Backend API is running. Access the frontend app via React dev server on port 3001.");
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express Server running on http://localhost:${PORT}`);
});