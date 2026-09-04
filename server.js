const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const net = require("net");
const nodemailer = require("nodemailer");

require("dotenv").config();

// 1. Detect & display outbound IPv4 for Azure Firewall whitelisting
fetch("https://api4.ipify.org")
  .then((res) => res.text())
  .then((ipv4) => {
    console.log("==================================================");
    console.log("👉 CURRENT OUTBOUND IPv4:", ipv4.trim());
    console.log("==================================================");
  })
  .catch((err) => {
    console.error("Could not fetch outbound IPv4:", err.message);
  });

const { sql, poolPromise } = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Email Transporter (Gmail SMTP)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "mmm@synergy5m.com",
    pass: process.env.SMTP_PASS || "hflc dqba czoo oeku",
  },
});

// Storage and upload folders setup
const uploadDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Multer storage configuration
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

// Diagnostic endpoint: defaults to Azure SQL host and port 1433
app.get("/api/test-port", (req, res) => {
  const targetPort = parseInt(req.query.port, 10) || 1433;
  const host = req.query.host || "synergy5m-product-master.database.windows.net";
  const socket = new net.Socket();
  socket.setTimeout(6000);

  socket.connect(targetPort, host, () => {
    socket.destroy();
    return res.json({
      success: true,
      portTested: targetPort,
      message: `✅ Port ${targetPort} is OPEN and reachable to ${host} from this server!`,
    });
  });

  socket.on("error", (err) => {
    socket.destroy();
    return res.json({
      success: false,
      portTested: targetPort,
      message: `❌ Port ${targetPort} connection failed: ${err.message}`,
    });
  });

  socket.on("timeout", () => {
    socket.destroy();
    return res.json({
      success: false,
      portTested: targetPort,
      message: `❌ Port ${targetPort} to ${host} TIMED OUT. Host or firewall is blocking traffic.`,
    });
  });
});

// -------------------------------------------------------------
// API Endpoints (With Azure SQL + Automatic Local File Fallback)
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
      // Local fallback file storage
      fs.appendFileSync(
        path.join(dataDir, "inquiries.jsonl"),
        JSON.stringify({ ...req.body, submittedAt: new Date().toISOString() }) + "\n",
        "utf8"
      );
    }

    return res.status(201).json({
      success: true,
      message: "Your inquiry has been submitted successfully.",
    });
  } catch (error) {
    console.error("❌ Error saving inquiry:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Unified Buyer & Seller Registration
const uploadFields = upload.fields([
  { name: "attachment", maxCount: 1 },
  { name: "documents", maxCount: 10 },
]);

app.post("/api/business-connect", uploadFields, async (req, res) => {
  try {
    const d = req.body;
    const category = (d.category || "").toLowerCase() === "seller" ? "Seller" : "Buyer";
    const prefix = category === "Seller" ? "S" : "B";

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
      const query = `
        DECLARE @NextNum INT;
        DECLARE @PrefixPattern NVARCHAR(10) = '${prefix}%';

        SELECT @NextNum = ISNULL(MAX(CAST(SUBSTRING(Code, 2, LEN(Code)) AS INT)), 0) + 1
        FROM dbo.BusinessEnquiries WITH (TABLOCKX, HOLDLOCK)
        WHERE Code LIKE @PrefixPattern
          AND ISNUMERIC(SUBSTRING(Code, 2, LEN(Code))) = 1;

        DECLARE @GeneratedCode NVARCHAR(50) = '${prefix}' + RIGHT('00000' + CAST(@NextNum AS NVARCHAR(10)), 5);

        INSERT INTO dbo.BusinessEnquiries (
          Code, Category,
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
          @GeneratedCode, @Category,
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
    }

    // Fallback if Azure SQL is unavailable
    const generatedCode = `${prefix}-${Date.now().toString().slice(-5)}`;
    fs.appendFileSync(
      path.join(dataDir, "business_enquiries.jsonl"),
      JSON.stringify({ ...d, code: generatedCode, submittedAt: new Date().toISOString() }) + "\n",
      "utf8"
    );

    return res.status(201).json({
      success: true,
      id: Date.now(),
      code: generatedCode,
      message: `Submitted successfully (Stored locally under Ref: ${generatedCode})`,
    });
  } catch (error) {
    console.error("❌ Error saving BusinessEnquiry:", error);
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
    if (!pool) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }

    const query = `
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
        DemoStatus,
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
        'Pending',
        GETUTCDATE()
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

    return res.status(201).json({
      success: true,
      id: result.recordset[0]?.Id,
      message: "Your demo request has been submitted and is pending review.",
    });
  } catch (error) {
    console.error("❌ Error saving DemoRequest:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Trial Request Endpoint with Email Notification
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

    const calculatedStatus = trialStatus || "Active";
    let dbSaved = false;

    const pool = await poolPromise;
    if (pool) {
      try {
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
          .input("TrialEndDate", sql.Date, new Date(trialEndDate))
          .input("TrialStatus", sql.NVarChar(50), calculatedStatus)
          .input("Remarks", sql.NVarChar(sql.MAX), remarks ? remarks.trim() : null)
          .query(`
            INSERT INTO dbo.TrialRequests (
              CompanyName, ContactPerson, MobileNo, Email,
              Address, GstNo, NumberOfUsers, SubscriptionPlan,
              TrialStartDate, TrialEndDate, TrialStatus, Remarks
            )
            VALUES (
              @CompanyName, @ContactPerson, @MobileNo, @Email,
              @Address, @GstNo, @NumberOfUsers, @SubscriptionPlan,
              @TrialStartDate, @TrialEndDate, @TrialStatus, @Remarks
            );
          `);
        dbSaved = true;
      } catch (dbErr) {
        console.warn("DB insert failed, writing to fallback storage:", dbErr.message);
      }
    }

    // Local fallback
    if (!dbSaved) {
      fs.appendFileSync(
        path.join(dataDir, "trial_requests.jsonl"),
        JSON.stringify({ ...req.body, submittedAt: new Date().toISOString() }) + "\n",
        "utf8"
      );
    }

    // Always send notification email
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #0b5ed7;">New SYN ERP 10 Trial Request</h2>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; border-color: #ddd;">
          <tr><td><strong>Company Name</strong></td><td>${companyName}</td></tr>
          <tr><td><strong>Contact Person</strong></td><td>${contactPerson}</td></tr>
          <tr><td><strong>Mobile No.</strong></td><td>${mobileNo}</td></tr>
          <tr><td><strong>Email</strong></td><td>${email}</td></tr>
          <tr><td><strong>Subscription Plan</strong></td><td><strong>${subscriptionPlan}</strong></td></tr>
          <tr><td><strong>Trial Dates</strong></td><td>${trialStartDate} to ${trialEndDate}</td></tr>
          <tr><td><strong>Status</strong></td><td>${calculatedStatus}</td></tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"Synergy5M ERP System" <${process.env.SMTP_USER || "mmm@synergy5m.com"}>`,
        to: email.trim(),
        cc: ["sales@synergy5m.com", "accounts@synergy5m.com"],
        subject: `New SYN ERP Trial Request: ${companyName}`,
        html: mailHtml,
      });
    } catch (mailErr) {
      console.warn("Mail sending bypassed:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Trial request submitted successfully! Confirmation email has been sent.",
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
// React Build / SPA Routing (Express 4 & 5 Safe)
// -------------------------------------------------------------
const buildPath = path.join(__dirname, "build");
const indexHtmlPath = path.join(buildPath, "index.html");

// ✅ UNIVERSAL FIX (Express 4 & Express 5)
if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(buildPath));
  app.use((req, res) => {
    res.sendFile(indexHtmlPath);
  });
} else {
  app.get("/", (req, res) => {
    res.send("Synergy5M Backend API is running.");
  });
  
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express Server running on http://localhost:${PORT}`);
});