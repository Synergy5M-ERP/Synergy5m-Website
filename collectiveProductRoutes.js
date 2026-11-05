const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { sql, poolPromise } = require('./db');
const { verifyAdminToken } = require('./auth');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: parseInt(process.env.SMTP_PORT, 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 3,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "development" ? false : true,
  },
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/**
 * Robust Admin Authentication Middleware
 * Enforces JWT verification in production or whenever Authorization header is present.
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
    return next();
  }
  return verifyAdminToken(req, res, next);
}

const dataDir = path.join(__dirname, 'data');
const productsFile = path.join(dataDir, 'collective_products.json');
const enquiriesFile = path.join(dataDir, 'collective_enquiries.json');
const offersFile = path.join(dataDir, 'collective_offers.json');

function readJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn(`Warning reading ${filePath}:`, err.message);
  }
  return [];
}

function writeJsonFile(filePath, data) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn(`Warning writing ${filePath}:`, err.message);
  }
}

/**
 * AUTO-INITIALIZATION OF THE 3 COLLECTIVE BUYING TABLES:
 * 1. [CollectiveProducts]
 * 2. [CollectiveEnquiries]
 * 3. [CollectiveOffers]
 */
async function ensureCollectiveTables() {
  try {
    const pool = await poolPromise;
    if (!pool) return;

    await pool.request().query(`
      -- 1. CollectiveProducts table
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollectiveProducts]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[CollectiveProducts] (
          [Id] NVARCHAR(100) PRIMARY KEY,
          [ProductName] NVARCHAR(255) NOT NULL,
          [Category] NVARCHAR(150),
          [GradeVariant] NVARCHAR(150),
          [Sku] NVARCHAR(100),
          [HsnCode] NVARCHAR(50),
          [Status] NVARCHAR(50) DEFAULT 'Open for Enquiries',
          [Uom] NVARCHAR(50) DEFAULT 'MT',
          [MinEnquiryQuantity] DECIMAL(18, 2) DEFAULT 1,
          [MaxEnquiryQuantity] DECIMAL(18, 2),
          [EnquiryOpeningDate] DATE,
          [EnquiryClosingDate] DATE,
          [ProductJson] NVARCHAR(MAX),
          [CreatedAt] DATETIME DEFAULT GETDATE(),
          [UpdatedAt] DATETIME DEFAULT GETDATE()
        );
      END

      -- 2. CollectiveEnquiries table
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollectiveEnquiries]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[CollectiveEnquiries] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [ProductId] NVARCHAR(100),
          [ProductName] NVARCHAR(255),
          [CompanyName] NVARCHAR(255),
          [ContactPerson] NVARCHAR(255),
          [Email] NVARCHAR(255),
          [Phone] NVARCHAR(50),
          [RequiredQuantity] DECIMAL(18, 2),
          [Uom] NVARCHAR(50) DEFAULT 'MT',
          [DeliveryLocation] NVARCHAR(255),
          [Region] NVARCHAR(100) DEFAULT 'Domestic',
          [TargetDeliveryDate] DATE,
          [Comments] NVARCHAR(MAX),
          [Status] NVARCHAR(50) DEFAULT 'Submitted',
          [CreatedAt] DATETIME DEFAULT GETDATE()
        );
      END

      -- Ensure Region column exists in CollectiveEnquiries
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollectiveEnquiries]') AND type in (N'U'))
      BEGIN
        IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[CollectiveEnquiries]') AND name = 'Region')
        BEGIN
          ALTER TABLE [dbo].[CollectiveEnquiries] ADD [Region] NVARCHAR(100) DEFAULT 'Domestic';
        END
      END

      -- 3. CollectiveOffers table
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CollectiveOffers]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[CollectiveOffers] (
          [Id] NVARCHAR(100) PRIMARY KEY,
          [OpportunityId] NVARCHAR(100),
          [ProductName] NVARCHAR(255),
          [SupplierName] NVARCHAR(255),
          [SupplierEmail] NVARCHAR(255),
          [UnitPrice] DECIMAL(18, 2),
          [Currency] NVARCHAR(20) DEFAULT 'INR',
          [AvailableQuantity] DECIMAL(18, 2),
          [Moq] DECIMAL(18, 2),
          [PriceBreaks] NVARCHAR(MAX),
          [Taxes] NVARCHAR(255),
          [FreightBasis] NVARCHAR(100),
          [LeadTime] NVARCHAR(100),
          [PaymentTerms] NVARCHAR(255),
          [OfferValidity] NVARCHAR(100),
          [Origin] NVARCHAR(100),
          [Remarks] NVARCHAR(MAX),
          [Status] NVARCHAR(50) DEFAULT 'SUBMITTED',
          [OfferJson] NVARCHAR(MAX),
          [CreatedAt] DATETIME DEFAULT GETDATE(),
          [UpdatedAt] DATETIME DEFAULT GETDATE()
        );
      END
    `);
  } catch (err) {
    console.warn('Table initialization warning:', err.message);
  }
}

// Run table check
ensureCollectiveTables();


/**
 * GET /api/public/products
 * Fetches all products strictly from [CollectiveProducts] table (with fallback).
 */
router.get('/public/products', async (req, res) => {
  try {
    const pool = await poolPromise;
    let dbProducts = [];

    if (pool) {
      try {
        const result = await pool.request().query(`
          SELECT Id, ProductName, Category, GradeVariant, Sku, HsnCode, Status, Uom,
                 MinEnquiryQuantity, MaxEnquiryQuantity, EnquiryOpeningDate, EnquiryClosingDate,
                 ProductJson, CreatedAt, UpdatedAt
          FROM CollectiveProducts
          ORDER BY CreatedAt DESC
        `);

        dbProducts = (result.recordset || [])
          .map((row) => {
            try {
              if (row.ProductJson) {
                const parsed = JSON.parse(row.ProductJson);
                return {
                  ...parsed,
                  id: row.Id,
                  createdAt: row.CreatedAt,
                  updatedAt: row.UpdatedAt
                };
              }
            } catch (e) {}

            return {
              id: row.Id,
              productMaster: {
                productName: row.ProductName,
                category: row.Category,
                gradeVariant: row.GradeVariant,
                sku: row.Sku,
                hsnCode: row.HsnCode,
                uom: row.Uom
              },
              opportunity: {
                status: row.Status || 'Open for Enquiries',
                minEnquiryQuantity: row.MinEnquiryQuantity || 1,
                maxEnquiryQuantity: row.MaxEnquiryQuantity,
                enquiryOpeningDate: row.EnquiryOpeningDate,
                enquiryClosingDate: row.EnquiryClosingDate
              },
              createdAt: row.CreatedAt,
              updatedAt: row.UpdatedAt
            };
          })
          .filter(Boolean);
      } catch (dbErr) {
        console.warn('DB error in /public/products:', dbErr.message);
      }
    }

    if (dbProducts.length === 0) {
      const local = readJsonFile(productsFile);
      if (Array.isArray(local) && local.length > 0) {
        dbProducts = local;
      }
    }

    return res.json({
      success: true,
      count: dbProducts.length,
      data: dbProducts,
      source: pool ? 'database' : 'file-cache'
    });
  } catch (err) {
    console.error('Error fetching public products:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
});

/**
 * GET /api/admin/master-items
 * Fetches items from [CollectiveProducts] for admin auto-population/lookup.
 */
router.get('/admin/master-items', requireAdminAuth, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database connection unavailable' });
    }

    const { search = '', category = '' } = req.query;
    const request = pool.request();

    let query = `
      SELECT DISTINCT TOP 200
        [Id],
        LTRIM(RTRIM([ProductName])) AS Item_Name,
        LTRIM(RTRIM(ISNULL([Category], 'General'))) AS ItemCategory,
        '' AS Sub_Category,
        LTRIM(RTRIM(ISNULL([GradeVariant], ''))) AS Grade,
        LTRIM(RTRIM(ISNULL([Uom], 'MT'))) AS Unit_Of_Measurement,
        LTRIM(RTRIM(ISNULL(CAST([HsnCode] AS VARCHAR(50)), ''))) AS HS_Code,
        LTRIM(RTRIM(ISNULL([Sku], ''))) AS Item_Code,
        'Standard Industrial Packaging' AS Packaging,
        ISNULL([MinEnquiryQuantity], 1) AS MOQ,
        NULL AS Average_Price,
        'Synergy5M' AS Company_Name,
        'Industrial' AS Industry
      FROM [CollectiveProducts]
      WHERE [ProductName] IS NOT NULL AND LTRIM(RTRIM([ProductName])) <> ''
    `;

    if (search.trim()) {
      request.input('search', sql.NVarChar, `%${search.trim()}%`);
      query += ` AND (
        [ProductName] LIKE @search 
        OR [GradeVariant] LIKE @search 
        OR [Category] LIKE @search 
        OR [Sku] LIKE @search
      )`;
    }

    if (category.trim() && category !== 'All') {
      request.input('category', sql.NVarChar, category.trim());
      query += ` AND UPPER(LTRIM(RTRIM(ISNULL([Category], '')))) = UPPER(@category)`;
    }

    query += ` ORDER BY Item_Name ASC`;

    const result = await request.query(query);
    return res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset
    });
  } catch (err) {
    console.error('Error fetching collective items:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch items.' });
  }
});

/**
 * GET /api/public/products/:id
 * Retrieve single product by id strictly from [CollectiveProducts] table.
 */
router.get('/public/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database connection unavailable' });
    }

    const result = await pool.request()
      .input('Id', sql.NVarChar, id)
      .query(`SELECT ProductJson FROM CollectiveProducts WHERE Id = @Id`);

    if (result.recordset && result.recordset.length > 0) {
      try {
        const product = JSON.parse(result.recordset[0].ProductJson);
        return res.json({ success: true, data: product });
      } catch (e) {
        return res.json({ success: true, data: result.recordset[0] });
      }
    }

    return res.status(404).json({ success: false, notFound: true, message: 'Data not found' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve product details.' });
  }
});

/**
 * POST /api/admin/products
 * Saves a new product master + opportunity round into the database.
 */
router.post('/admin/products', requireAdminAuth, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.productMaster || !payload.opportunity) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product payload. Product master and opportunity details are required.'
      });
    }

    const pool = await poolPromise;
    const newId = payload.id || `PROD-${Date.now()}`;
    const newRecord = {
      id: newId,
      publishedAt: payload.publishedAt || new Date().toISOString(),
      ...payload
    };

    let savedToDb = false;
    if (pool) {
      try {
        const jsonStr = JSON.stringify(newRecord);
        await pool.request()
          .input('Id', sql.NVarChar, newId)
          .input('ProductName', sql.NVarChar, payload.productMaster.productName || 'Unnamed')
          .input('Category', sql.NVarChar, payload.productMaster.category || 'General')
          .input('GradeVariant', sql.NVarChar, payload.productMaster.gradeVariant || '')
          .input('Sku', sql.NVarChar, payload.productMaster.sku || '')
          .input('HsnCode', sql.NVarChar, payload.productMaster.hsnCode || '')
          .input('Status', sql.NVarChar, payload.opportunity.status || 'Open for Enquiries')
          .input('Uom', sql.NVarChar, payload.productMaster.uom || 'MT')
          .input('MinEnquiryQuantity', sql.Decimal(18, 2), payload.opportunity.minEnquiryQuantity || 1)
          .input('MaxEnquiryQuantity', sql.Decimal(18, 2), payload.opportunity.maxEnquiryQuantity || null)
          .input('EnquiryOpeningDate', sql.Date, payload.opportunity.enquiryOpeningDate || null)
          .input('EnquiryClosingDate', sql.Date, payload.opportunity.enquiryClosingDate || null)
          .input('ProductJson', sql.NVarChar(sql.MAX), jsonStr)
          .query(`
            IF EXISTS (SELECT 1 FROM CollectiveProducts WHERE Id = @Id)
            BEGIN
              UPDATE CollectiveProducts
              SET ProductName = @ProductName,
                  Category = @Category,
                  GradeVariant = @GradeVariant,
                  Sku = @Sku,
                  HsnCode = @HsnCode,
                  Status = @Status,
                  Uom = @Uom,
                  MinEnquiryQuantity = @MinEnquiryQuantity,
                  MaxEnquiryQuantity = @MaxEnquiryQuantity,
                  EnquiryOpeningDate = @EnquiryOpeningDate,
                  EnquiryClosingDate = @EnquiryClosingDate,
                  ProductJson = @ProductJson,
                  UpdatedAt = GETDATE()
              WHERE Id = @Id;
            END
            ELSE
            BEGIN
              INSERT INTO CollectiveProducts (
                Id, ProductName, Category, GradeVariant, Sku, HsnCode, Status,
                Uom, MinEnquiryQuantity, MaxEnquiryQuantity, EnquiryOpeningDate,
                EnquiryClosingDate, ProductJson, CreatedAt, UpdatedAt
              ) VALUES (
                @Id, @ProductName, @Category, @GradeVariant, @Sku, @HsnCode, @Status,
                @Uom, @MinEnquiryQuantity, @MaxEnquiryQuantity, @EnquiryOpeningDate,
                @EnquiryClosingDate, @ProductJson, GETDATE(), GETDATE()
              );
            END
          `);
        savedToDb = true;
      } catch (dbErr) {
        console.warn('DB error writing product:', dbErr.message);
      }
    }

    // Always sync to local JSON file for dev/offline resilience
    try {
      const existing = readJsonFile(productsFile);
      const filtered = existing.filter((p) => p.id !== newId);
      filtered.unshift(newRecord);
      writeJsonFile(productsFile, filtered);
    } catch (e) {}

    return res.status(201).json({
      success: true,
      message: 'Product successfully published.',
      savedToDb,
      data: newRecord
    });
  } catch (err) {
    console.error('Error saving product:', err);
    return res.status(500).json({ success: false, message: 'Failed to save product. Please try again.' });
  }
});

/**
 * POST /api/public/enquiries
 * Inserts a buyer enquiry directly into [CollectiveEnquiries] table.
 */
router.post('/public/enquiries', async (req, res) => {
  try {
    const {
      productId,
      productName,
      companyName,
      contactPerson,
      email,
      phone,
      requiredQuantity,
      uom,
      deliveryLocation,
      region,
      targetDeliveryDate,
      comments
    } = req.body;

    const safeRegion = String(region || 'Domestic').trim() === 'International' ? 'International' : 'Domestic';

    if (!companyName || !email || !phone || !requiredQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, phone, and quantity are required.'
      });
    }

    // 1. Strict numeric quantity validation (must be positive > 0)
    const parsedQty = parseFloat(requiredQuantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Required quantity must be a valid positive number greater than 0.'
      });
    }

    // 2. Email format validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    const cleanEmail = String(email).trim().toLowerCase();
    if (cleanEmail.includes('..') || !emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid business email address.'
      });
    }

    // 3. Phone format validation
    const cleanPhone = String(phone).trim();
    const phoneRegex = /^[+]?[\d\s\-().]{7,25}$/;
    const digitsOnly = cleanPhone.replace(/[^0-9]/g, '');
    const subscriberDigits = digitsOnly.slice(-10);
    const isDummy = subscriberDigits.length >= 7 && /^(\d)\1+$/.test(subscriberDigits);

    if (!phoneRegex.test(cleanPhone) || digitsOnly.length < 10 || digitsOnly.length > 15 || isDummy) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid contact phone or mobile number (10 to 15 digits).'
      });
    }

    // 4. Target delivery date validation (cannot be in the past)
    let sanitizedDeliveryDate = null;
    if (targetDeliveryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(targetDeliveryDate);
      if (isNaN(targetDate.getTime()) || targetDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Target delivery date cannot be in the past. Please select today or a future date.'
        });
      }
      sanitizedDeliveryDate = targetDate.toISOString().split('T')[0];
    }

    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Database service is currently unavailable.' });
    }

    const enquiryRecord = {
      productId: productId || null,
      productName: String(productName || 'Collective Buy Product').trim(),
      companyName: String(companyName).trim(),
      contactPerson: String(contactPerson || companyName).trim(),
      email: cleanEmail,
      phone: cleanPhone,
      requiredQuantity: parsedQty,
      uom: String(uom || 'MT').trim(),
      deliveryLocation: String(deliveryLocation || '').trim(),
      region: safeRegion,
      targetDeliveryDate: sanitizedDeliveryDate,
      comments: String(comments || '').trim(),
      status: 'Submitted'
    };

    let insertedId = null;
    try {
      const result = await pool.request()
        .input('ProductId', sql.NVarChar, enquiryRecord.productId)
        .input('ProductName', sql.NVarChar, enquiryRecord.productName)
        .input('CompanyName', sql.NVarChar, enquiryRecord.companyName)
        .input('ContactPerson', sql.NVarChar, enquiryRecord.contactPerson)
        .input('Email', sql.NVarChar, enquiryRecord.email)
        .input('Phone', sql.NVarChar, enquiryRecord.phone)
        .input('RequiredQuantity', sql.Decimal(18, 2), enquiryRecord.requiredQuantity)
        .input('Uom', sql.NVarChar, enquiryRecord.uom)
        .input('DeliveryLocation', sql.NVarChar, enquiryRecord.deliveryLocation)
        .input('Region', sql.NVarChar, enquiryRecord.region)
        .input('TargetDeliveryDate', sql.Date, enquiryRecord.targetDeliveryDate)
        .input('Comments', sql.NVarChar, enquiryRecord.comments)
        .input('Status', sql.NVarChar, enquiryRecord.status)
        .query(`
          INSERT INTO CollectiveEnquiries (
            ProductId, ProductName, CompanyName, ContactPerson, Email, Phone,
            RequiredQuantity, Uom, DeliveryLocation, Region, TargetDeliveryDate, Comments, Status, CreatedAt
          ) 
          OUTPUT INSERTED.Id
          VALUES (
            @ProductId, @ProductName, @CompanyName, @ContactPerson, @Email, @Phone,
            @RequiredQuantity, @Uom, @DeliveryLocation, @Region, @TargetDeliveryDate, @Comments, @Status, GETDATE()
          )
        `);
      insertedId = result.recordset && result.recordset[0] ? result.recordset[0].Id : null;
    } catch (insertErr) {
      if (insertErr.message && insertErr.message.includes("Invalid column name 'Region'")) {
        const fallbackResult = await pool.request()
          .input('ProductId', sql.NVarChar, enquiryRecord.productId)
          .input('ProductName', sql.NVarChar, enquiryRecord.productName)
          .input('CompanyName', sql.NVarChar, enquiryRecord.companyName)
          .input('ContactPerson', sql.NVarChar, enquiryRecord.contactPerson)
          .input('Email', sql.NVarChar, enquiryRecord.email)
          .input('Phone', sql.NVarChar, enquiryRecord.phone)
          .input('RequiredQuantity', sql.Decimal(18, 2), enquiryRecord.requiredQuantity)
          .input('Uom', sql.NVarChar, enquiryRecord.uom)
          .input('DeliveryLocation', sql.NVarChar, enquiryRecord.deliveryLocation)
          .input('TargetDeliveryDate', sql.Date, enquiryRecord.targetDeliveryDate)
          .input('Comments', sql.NVarChar, `[Region: ${enquiryRecord.region}] ${enquiryRecord.comments}`)
          .input('Status', sql.NVarChar, enquiryRecord.status)
          .query(`
            INSERT INTO CollectiveEnquiries (
              ProductId, ProductName, CompanyName, ContactPerson, Email, Phone,
              RequiredQuantity, Uom, DeliveryLocation, TargetDeliveryDate, Comments, Status, CreatedAt
            ) 
            OUTPUT INSERTED.Id
            VALUES (
              @ProductId, @ProductName, @CompanyName, @ContactPerson, @Email, @Phone,
              @RequiredQuantity, @Uom, @DeliveryLocation, @TargetDeliveryDate, @Comments, @Status, GETDATE()
            )
          `);
        insertedId = fallbackResult.recordset && fallbackResult.recordset[0] ? fallbackResult.recordset[0].Id : null;
      } else {
        throw insertErr;
      }
    }

    // Send confirmation email to the entered email of buyer with seller in CC
    (async () => {
      try {
        const sellerEmail = process.env.SELLER_EMAIL || process.env.SALES_EMAIL || process.env.SMTP_USER || "sales@synergy5m.com";
        const safeUom = enquiryRecord.uom || 'MT';
        const formattedQty = `${Number(enquiryRecord.requiredQuantity).toLocaleString('en-IN')} ${safeUom}`;
        const formattedDate = enquiryRecord.targetDeliveryDate 
          ? new Date(enquiryRecord.targetDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Immediate / Open';

        const buyerEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Enquiry Registration Confirmation</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 24px 12px;">
              <tr>
                <td align="center">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
                    
                    <!-- Header Banner -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #0e7c86 0%, #14524a 100%); padding: 26px 32px; text-align: left; color: #ffffff;">
                        <table width="100%" border="0" cellspacing="0" cellpadding="0">
                          <tr>
                            <td>
                              <span style="display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: rgba(255,255,255,0.18); padding: 4px 12px; border-radius: 20px; margin-bottom: 8px;">
                                Synergy5M · Collective Buy Desk
                              </span>
                              <h1 style="margin: 0; font-size: 21px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">
                                Collective Buy Enquiry Confirmation
                              </h1>
                              <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">
                                Product Round: ${escapeHtml(enquiryRecord.productName)}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                      <td style="padding: 28px 32px;">
                        <p style="margin: 0 0 14px; font-size: 15px; font-weight: 700; color: #0f172a;">
                          Dear ${escapeHtml(enquiryRecord.contactPerson || enquiryRecord.companyName)},
                        </p>
                        <p style="margin: 0 0 20px; font-size: 13.5px; line-height: 1.6; color: #334155;">
                          Thank you for registering your requirement for <strong>${escapeHtml(enquiryRecord.productName)}</strong> on the Synergy5M Collective Procurement portal. We have successfully registered your buying enquiry into the active collective demand pooling round.
                        </p>

                        <!-- Summary Data Card -->
                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
                          <div style="background-color: #0e7c86; color: #ffffff; padding: 10px 16px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                            Registered Requirement Summary
                          </div>
                          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; line-height: 1.5;">
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                              <td style="padding: 10px 16px; width: 40%; color: #64748b; font-weight: 500;">Product Name</td>
                              <td style="padding: 10px 16px; width: 60%; color: #0f172a; font-weight: 700;">${escapeHtml(enquiryRecord.productName)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Required Quantity</td>
                              <td style="padding: 10px 16px; color: #ea580c; font-weight: 800; font-size: 14.5px;">${escapeHtml(formattedQty)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Delivery Place / Location</td>
                              <td style="padding: 10px 16px; color: #0f172a; font-weight: 700;">${escapeHtml(enquiryRecord.deliveryLocation || 'As specified in order')}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Sourcing Region</td>
                              <td style="padding: 10px 16px; color: #0f172a; font-weight: 700;">
                                <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 11.5px; font-weight: 700;">
                                  ${escapeHtml(enquiryRecord.region || 'Domestic')}
                                </span>
                              </td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Target Delivery Date</td>
                              <td style="padding: 10px 16px; color: #0f172a; font-weight: 600;">${escapeHtml(formattedDate)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Buyer / Company Name</td>
                              <td style="padding: 10px 16px; color: #0f172a; font-weight: 600;">${escapeHtml(enquiryRecord.companyName)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Contact Person</td>
                              <td style="padding: 10px 16px; color: #0f172a;">${escapeHtml(enquiryRecord.contactPerson)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background: #ffffff;">
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500;">Contact Mobile</td>
                              <td style="padding: 10px 16px; color: #0f172a; font-family: monospace;">${escapeHtml(enquiryRecord.phone)}</td>
                            </tr>
                            ${enquiryRecord.comments ? `
                            <tr>
                              <td style="padding: 10px 16px; color: #64748b; font-weight: 500; vertical-align: top;">Additional Remarks</td>
                              <td style="padding: 10px 16px; color: #475569; font-style: italic;">"${escapeHtml(enquiryRecord.comments)}"</td>
                            </tr>` : ''}
                          </table>
                        </div>

                        <!-- What Happens Next -->
                        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px;">
                          <h4 style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #065f46;">
                            What Happens Next in the Collective Round:
                          </h4>
                          <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #047857; line-height: 1.5;">
                            <li><strong>Demand Pooling:</strong> Your required volume (${escapeHtml(formattedQty)}) is consolidated with other registered buyers.</li>
                            <li><strong>Supplier Pricing:</strong> Synergy5M negotiates bulk ex-plant pricing directly with certified manufacturers.</li>
                            <li><strong>Offer Dispatch:</strong> You will receive formal supplier quotations with verified volume discount allocations.</li>
                          </ul>
                        </div>

                        <p style="margin: 18px 0 0; font-size: 12.5px; color: #64748b; line-height: 1.5;">
                          If you have any questions or wish to modify your requirement, please reply directly to this email or reach our sales desk at <a href="mailto:${sellerEmail}" style="color: #0e7c86; text-decoration: underline;">${sellerEmail}</a>.
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #94a3b8; line-height: 1.5;">
                        <div style="font-weight: 700; color: #475569;">Synergy5M LLP — B2B Demand Pooling & Collective Procurement</div>
                        <div>Pune, Maharashtra, India • <a href="https://synergy5m.com" style="color: #0e7c86; text-decoration: none;">synergy5m.com</a></div>
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
          from: `"Synergy5M Collective Buy Desk" <${process.env.SMTP_USER || "sales@synergy5m.com"}>`,
          to: cleanEmail,
          subject: `Enquiry Confirmation: Collective Buy Round for ${enquiryRecord.productName}`,
          html: buyerEmailHtml
        };

        if (sellerEmail && sellerEmail.toLowerCase() !== cleanEmail.toLowerCase()) {
          mailOptions.cc = sellerEmail;
        }

        await transporter.sendMail(mailOptions);
      } catch (mailErr) {
        console.warn('Asynchronous enquiry confirmation email notification error:', mailErr.message);
      }
    })();

    return res.status(201).json({
      success: true,
      message: 'Enquiry successfully submitted. Our aggregation desk will review your requirement shortly.',
      savedToDb: true,
      data: { id: insertedId, ...enquiryRecord }
    });
  } catch (err) {
    console.error('Error submitting enquiry:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit enquiry. Please try again.' });
  }
});

/**
 * GET /api/admin/collective-enquiries
 * Retrieve all buyer enquiries strictly from [CollectiveEnquiries] table.
 */
router.get('/admin/collective-enquiries', requireAdminAuth, async (req, res) => {
  try {
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database connection unavailable' });
    }

    let result;
    try {
      result = await pool.request().query(`
        SELECT Id, ProductId, ProductName, CompanyName, ContactPerson, Email, Phone,
               RequiredQuantity, Uom, DeliveryLocation, ISNULL(Region, 'Domestic') AS Region, TargetDeliveryDate, Comments, Status, CreatedAt
        FROM CollectiveEnquiries
        ORDER BY Id DESC
      `);
    } catch (qErr) {
      if (qErr.message && qErr.message.includes("Invalid column name 'Region'")) {
        result = await pool.request().query(`
          SELECT Id, ProductId, ProductName, CompanyName, ContactPerson, Email, Phone,
                 RequiredQuantity, Uom, DeliveryLocation, 'Domestic' AS Region, TargetDeliveryDate, Comments, Status, CreatedAt
          FROM CollectiveEnquiries
          ORDER BY Id DESC
        `);
      } else {
        throw qErr;
      }
    }

    const enquiries = (result.recordset || []).map((row) => ({
      id: row.Id,
      productId: row.ProductId,
      productName: row.ProductName,
      companyName: row.CompanyName,
      contactPerson: row.ContactPerson,
      email: row.Email,
      phone: row.Phone,
      requiredQuantity: row.RequiredQuantity,
      uom: row.Uom,
      deliveryLocation: row.DeliveryLocation,
      region: row.Region || 'Domestic',
      targetDeliveryDate: row.TargetDeliveryDate,
      comments: row.Comments,
      status: row.Status || 'Submitted',
      createdAt: row.CreatedAt
    }));

    return res.json({
      success: true,
      count: enquiries.length,
      data: enquiries,
      source: 'database'
    });
  } catch (err) {
    console.error('Error fetching collective enquiries:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch enquiries.' });
  }
});

/**
 * PATCH /api/admin/collective-enquiries/:id/status
 * Update status of an enquiry in [CollectiveEnquiries] table.
 */
router.patch('/admin/collective-enquiries/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database connection unavailable' });
    }

    await pool.request()
      .input('Id', sql.Int, parseInt(id, 10))
      .input('Status', sql.NVarChar, status)
      .query(`UPDATE CollectiveEnquiries SET Status = @Status WHERE Id = @Id`);

    return res.json({
      success: true,
      message: `Enquiry #${id} status updated to "${status}".`
    });
  } catch (err) {
    console.error('Error updating enquiry status:', err);
    return res.status(500).json({ success: false, message: 'Failed to update enquiry status.' });
  }
});

/**
 * DELETE /api/admin/collective-enquiries/:id
 * Delete an enquiry.
 */
router.delete('/admin/collective-enquiries/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Database connection unavailable' });
    }

    await pool.request()
      .input('Id', sql.Int, parseInt(id, 10))
      .query(`DELETE FROM CollectiveEnquiries WHERE Id = @Id`);

    return res.json({
      success: true,
      message: `Enquiry #${id} successfully removed.`
    });
  } catch (err) {
    console.error('Error deleting enquiry:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete enquiry.' });
  }
});

/**
 * GET /api/admin/products
 * Retrieve all collective products for admin dashboard.
 */
router.get('/admin/products', requireAdminAuth, async (req, res) => {
  try {
    const pool = await poolPromise;
    let products = [];

    if (pool) {
      try {
        const result = await pool.request().query(`
          SELECT Id, ProductName, Category, GradeVariant, Sku, HsnCode, Status, Uom,
                 MinEnquiryQuantity, MaxEnquiryQuantity, EnquiryOpeningDate, EnquiryClosingDate,
                 ProductJson, CreatedAt, UpdatedAt
          FROM CollectiveProducts
          ORDER BY CreatedAt DESC
        `);

        products = (result.recordset || []).map((row) => {
          try {
            if (row.ProductJson) {
              const parsed = JSON.parse(row.ProductJson);
              return {
                ...parsed,
                id: row.Id,
                createdAt: row.CreatedAt,
                updatedAt: row.UpdatedAt
              };
            }
          } catch (e) {}

          return {
            id: row.Id,
            productMaster: {
              productName: row.ProductName,
              category: row.Category,
              gradeVariant: row.GradeVariant,
              sku: row.Sku,
              hsnCode: row.HsnCode,
              uom: row.Uom
            },
            opportunity: {
              status: row.Status || 'Open for Enquiries',
              minEnquiryQuantity: row.MinEnquiryQuantity || 1,
              maxEnquiryQuantity: row.MaxEnquiryQuantity,
              enquiryOpeningDate: row.EnquiryOpeningDate,
              enquiryClosingDate: row.EnquiryClosingDate
            },
            createdAt: row.CreatedAt,
            updatedAt: row.UpdatedAt
          };
        });
      } catch (dbErr) {
        console.warn('DB error in /admin/products:', dbErr.message);
      }
    }

    if (products.length === 0) {
      const local = readJsonFile(productsFile);
      if (Array.isArray(local) && local.length > 0) {
        products = local;
      }
    }

    return res.json({ success: true, count: products.length, data: products, source: pool ? 'database' : 'file-cache' });
  } catch (err) {
    console.error('Error fetching admin products:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Delete a product.
 */
router.delete('/admin/products/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await poolPromise;
    if (pool) {
      try {
        await pool.request()
          .input('Id', sql.NVarChar, id)
          .query(`DELETE FROM CollectiveProducts WHERE Id = @Id`);
      } catch (e) {}
    }

    try {
      const local = readJsonFile(productsFile);
      const filtered = local.filter((p) => p.id !== id);
      writeJsonFile(productsFile, filtered);
    } catch (e) {}

    return res.json({
      success: true,
      message: `Product ${id} successfully removed.`
    });
  } catch (err) {
    console.error('Error deleting product:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
});

/**
 * GET /api/collective-buying/opportunities
 * Returns all active collective buying opportunity products strictly from [CollectiveProducts] table.
 */
router.get('/collective-buying/opportunities', async (req, res) => {
  try {
    const pool = await poolPromise;
    let list = [];

    if (pool) {
      try {
        const result = await pool.request().query(`
          SELECT Id, ProductName, Category, GradeVariant, Sku, HsnCode, Status, Uom,
                 MinEnquiryQuantity, MaxEnquiryQuantity, EnquiryOpeningDate, EnquiryClosingDate,
                 CreatedAt, UpdatedAt
          FROM CollectiveProducts
          ORDER BY CreatedAt DESC
        `);
        list = result.recordset || [];
      } catch (e) {}
    }

    if (list.length === 0) {
      const local = readJsonFile(productsFile);
      if (Array.isArray(local) && local.length > 0) {
        list = local.map((p) => ({
          Id: p.id,
          ProductName: p.productMaster?.productName || p.productName,
          Category: p.productMaster?.category || p.category,
          GradeVariant: p.productMaster?.gradeVariant || p.gradeVariant,
          Sku: p.productMaster?.sku || p.sku,
          Status: p.opportunity?.status || p.status,
          Uom: p.productMaster?.uom || p.uom,
          MinEnquiryQuantity: p.opportunity?.minEnquiryQuantity || p.minEnquiryQuantity,
          MaxEnquiryQuantity: p.opportunity?.maxEnquiryQuantity || p.maxEnquiryQuantity,
          EnquiryOpeningDate: p.opportunity?.enquiryOpeningDate,
          EnquiryClosingDate: p.opportunity?.enquiryClosingDate
        }));
      }
    }

    return res.json({
      success: true,
      count: list.length,
      data: list,
      source: pool ? 'database' : 'file-cache'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve product details.' });
  }
});

/**
 * GET /api/collective-buying/opportunity-data/:id?
 * Fetches exact opportunity data strictly from:
 * 1. [CollectiveProducts]
 * 2. [CollectiveEnquiries]
 * 3. [CollectiveOffers]
 */
router.get(['/collective-buying/opportunity-data', '/collective-buying/opportunity-data/:id'], async (req, res) => {
  try {
    const reqId = req.params.id || req.query.id;
    const pool = await poolPromise;

    // 1. Fetch available opportunities from [CollectiveProducts] (or local fallback)
    let allOpportunities = [];
    if (pool) {
      try {
        const oppsResult = await pool.request().query(`
          SELECT Id, ProductName, Category, GradeVariant, Sku, Status, Uom,
                 MinEnquiryQuantity, MaxEnquiryQuantity, EnquiryOpeningDate, EnquiryClosingDate
          FROM CollectiveProducts
          ORDER BY CreatedAt DESC
        `);
        allOpportunities = oppsResult.recordset || [];
      } catch (e) {
        console.warn('Error querying allOpportunities:', e.message);
      }
    }

    if (allOpportunities.length === 0) {
      const localProducts = readJsonFile(productsFile);
      if (Array.isArray(localProducts) && localProducts.length > 0) {
        allOpportunities = localProducts.map((p) => ({
          Id: p.id,
          ProductName: p.productMaster?.productName || p.productName,
          Category: p.productMaster?.category || p.category,
          GradeVariant: p.productMaster?.gradeVariant || p.gradeVariant,
          Sku: p.productMaster?.sku || p.sku,
          Status: p.opportunity?.status || p.status,
          Uom: p.productMaster?.uom || p.uom,
          MinEnquiryQuantity: p.opportunity?.minEnquiryQuantity || p.minEnquiryQuantity,
          MaxEnquiryQuantity: p.opportunity?.maxEnquiryQuantity || p.maxEnquiryQuantity,
          EnquiryOpeningDate: p.opportunity?.enquiryOpeningDate,
          EnquiryClosingDate: p.opportunity?.enquiryClosingDate
        }));
      }
    }

    // 2. Fetch specific product record from [CollectiveProducts]
    let productRecord = null;
    if (pool) {
      if (reqId && reqId !== 'default' && reqId !== 'CB-2026-0001') {
        const pReq = pool.request();
        pReq.input('Id', sql.NVarChar, reqId);
        const pResult = await pReq.query(`SELECT TOP 1 * FROM CollectiveProducts WHERE Id = @Id`);
        if (pResult.recordset && pResult.recordset.length > 0) {
          productRecord = pResult.recordset[0];
        }
      }

      // If specific ID was not found or no valid ID provided, fall back to the most recent record
      if (!productRecord) {
        const fallbackResult = await pool.request().query(`
          SELECT TOP 1 * FROM CollectiveProducts ORDER BY CreatedAt DESC
        `);
        if (fallbackResult.recordset && fallbackResult.recordset.length > 0) {
          productRecord = fallbackResult.recordset[0];
        }
      }
    }

    // Fallback to local file if DB is offline or returned no record
    if (!productRecord) {
      const localProducts = readJsonFile(productsFile);
      if (Array.isArray(localProducts) && localProducts.length > 0) {
        let match = null;
        if (reqId && reqId !== 'default' && reqId !== 'CB-2026-0001') {
          match = localProducts.find((p) => p.id === reqId);
        }
        productRecord = match || localProducts[0];
      }
    }

    // If still no record found anywhere, return 404 Data Not Found
    if (!productRecord) {
      return res.status(404).json({
        success: false,
        notFound: true,
        availableOpportunities: [],
        message: 'No collective buying opportunities are currently available.'
      });
    }

    // Parse ProductJson or build info from table columns
    let parsedJson = {};
    if (productRecord.ProductJson) {
      try {
        parsedJson = JSON.parse(productRecord.ProductJson);
      } catch (e) {}
    } else if (productRecord.productMaster) {
      parsedJson = productRecord;
    }

    const prodId = productRecord.Id || productRecord.id;
    const prodMaster = parsedJson.productMaster || {};
    const prodOpp = parsedJson.opportunity || {};

    const productName = prodMaster.productName || productRecord.ProductName || productRecord.productName || 'Industrial Product';
    const grade = prodMaster.gradeVariant || productRecord.GradeVariant || productRecord.gradeVariant || '-';
    const category = prodMaster.category || productRecord.Category || productRecord.category || 'Industrial';
    const uom = prodMaster.uom || productRecord.Uom || productRecord.uom || 'MT';
    const status = prodOpp.status || productRecord.Status || productRecord.status || 'Open for Offers';
    const targetQuantity = parseFloat(prodOpp.maxEnquiryQuantity || productRecord.MaxEnquiryQuantity || productRecord.maxEnquiryQuantity) || 100;
    const minQuantity = parseFloat(prodOpp.minEnquiryQuantity || productRecord.MinEnquiryQuantity || productRecord.minEnquiryQuantity) || 5;

    // 3. Query buyer demand strictly from [CollectiveEnquiries] table (or local fallback)
    let rawEnquiries = [];
    if (pool) {
      try {
        const enqResult = await pool.request()
          .input('Pid', sql.NVarChar, prodId)
          .input('Pname', sql.NVarChar, `%${productName}%`)
          .query(`
            SELECT Id, ProductId, ProductName, CompanyName, ContactPerson, Email, Phone,
                   RequiredQuantity, Uom, DeliveryLocation, TargetDeliveryDate, Comments, Status, CreatedAt
            FROM CollectiveEnquiries
            WHERE ProductId = @Pid OR ProductName LIKE @Pname
            ORDER BY Id ASC
          `);
        rawEnquiries = enqResult.recordset || [];
      } catch (e) {
        console.warn('Error querying buyer enquiries:', e.message);
      }
    }

    if (rawEnquiries.length === 0) {
      const localEnquiries = readJsonFile(enquiriesFile);
      if (Array.isArray(localEnquiries)) {
        rawEnquiries = localEnquiries.filter((e) => e.productId === prodId || (e.productName && e.productName.toLowerCase().includes(productName.toLowerCase())));
      }
    }

    // 4. Calculate exact consolidated demand summary strictly from enquiries
    let totalPotentialQuantity = 0;
    let committedQuantity = 0;
    let orderedQuantity = 0;
    let interestedQuantity = 0;
    let deliveredQuantity = 0;

    const anonymizedEnquiries = rawEnquiries.map((enq, index) => {
      const qty = parseFloat(enq.RequiredQuantity || enq.requiredQuantity || enq.Quantity || 0) || 0;
      const st = (enq.Status || enq.status || 'Submitted').trim();
      
      totalPotentialQuantity += qty;

      if (['Delivered', 'Fulfilled', 'Dispatched'].some(s => st.toLowerCase().includes(s.toLowerCase()))) {
        deliveredQuantity += qty;
        orderedQuantity += qty;
        committedQuantity += qty;
      } else if (['Ordered', 'PO Issued', 'Purchased', 'Order_Placed'].some(s => st.toLowerCase().includes(s.toLowerCase()))) {
        orderedQuantity += qty;
        committedQuantity += qty;
      } else if (['Committed', 'Allocated', 'Ready for PO', 'Confirmed', 'Closed'].some(s => st.toLowerCase().includes(s.toLowerCase()))) {
        committedQuantity += qty;
      } else {
        interestedQuantity += qty;
      }

      let region = enq.DeliveryLocation || enq.deliveryLocation || 'General Region';
      if (region.includes(',')) {
        region = region.split(',')[0].trim();
      }

      return {
        id: enq.Id || enq.id,
        ref: `Buyer ${String(index + 1).padStart(3, '0')}`,
        companyName: enq.CompanyName || enq.companyName || '',
        contactPerson: enq.ContactPerson || enq.contactPerson || '',
        targetDeliveryDate: enq.TargetDeliveryDate || enq.targetDeliveryDate || null,
        region: region,
        quantity: qty,
        uom: enq.Uom || enq.uom || uom,
        status: st.toLowerCase().includes('ordered') || st.toLowerCase().includes('po') ? 'Ordered' : (st.toLowerCase().includes('commit') || st.toLowerCase().includes('ready') ? 'Committed' : 'Interested'),
        date: (enq.CreatedAt || enq.createdAt) ? new Date(enq.CreatedAt || enq.createdAt).toLocaleDateString('en-GB') : 'Recent'
      };
    });

    const quantityNeeded = Math.max(0, targetQuantity - committedQuantity);
    const demandProgressPercent = targetQuantity > 0 ? Math.min(100, Math.round((committedQuantity / targetQuantity) * 100)) : 0;
    const buyerEnquiriesCount = anonymizedEnquiries.length;
    const deliveryRegionsCount = new Set(anonymizedEnquiries.map(b => b.region)).size || 0;

    // 5. Query supplier bids strictly from [CollectiveOffers] table (or local fallback)
    let supplierOffers = [];
    if (pool) {
      try {
        const quoRes = await pool.request()
          .input('Pid', sql.NVarChar, prodId)
          .input('Pname', sql.NVarChar, `%${productName}%`)
          .query(`
            SELECT TOP 20
              Id, OpportunityId, ProductName, SupplierName, SupplierEmail,
              UnitPrice, Currency, AvailableQuantity, Moq, PriceBreaks,
              Taxes, FreightBasis, LeadTime, PaymentTerms, OfferValidity,
              Origin, Remarks, Status, CreatedAt
            FROM CollectiveOffers
            WHERE OpportunityId = @Pid OR ProductName LIKE @Pname
            ORDER BY CreatedAt DESC
          `);
        supplierOffers = quoRes.recordset || [];
      } catch (e) {
        console.warn('Error querying supplier offers:', e.message);
      }
    }

    if (supplierOffers.length === 0) {
      const localOffers = readJsonFile(offersFile);
      if (Array.isArray(localOffers)) {
        supplierOffers = localOffers.filter((o) => o.opportunityId === prodId || (o.productName && o.productName.toLowerCase().includes(productName.toLowerCase())));
      }
    }

    return res.json({
      success: true,
      source: 'database',
      opportunity: {
        id: prodId,
        productName,
        grade,
        category,
        sourcing: Array.isArray(prodOpp.sourcingOptions) ? prodOpp.sourcingOptions.join(' + ') : (prodOpp.sourcingPreference || 'Domestic + Import'),
        status,
        publicationDate: productRecord.EnquiryOpeningDate ? new Date(productRecord.EnquiryOpeningDate).toLocaleDateString('en-GB') : (productRecord.CreatedAt ? new Date(productRecord.CreatedAt).toLocaleDateString('en-GB') : '-'),
        closingDate: productRecord.EnquiryClosingDate ? new Date(productRecord.EnquiryClosingDate).toLocaleDateString('en-GB') : '-',
        closingTime: '17:00 IST',
        uom,
        opportunityManager: prodOpp.manager || {
          name: 'Procurement Aggregation Desk',
          role: 'Lead Opportunity Manager',
          email: 'procurement@synergy5m.com',
          phone: '+91 (020) 6789-5500'
        },
        specifications: {
          productName,
          gradeVariant: grade,
          form: prodMaster.physicalForm || 'Standard',
          uom,
          technicalParameters: Array.isArray(prodMaster.specifications) ? prodMaster.specifications : [],
          packaging: prodMaster.packagingType || 'Standard Industrial Packaging',
          certifications: prodMaster.certifications || 'Standard Industrial Quality Assurance',
          safetyDocs: prodMaster.safetyDocs || 'TDS & MSDS Available',
          equivalentGrades: prodMaster.equivalentGrades || 'Standard Equivalent',
          testingConditions: prodMaster.testingConditions || 'Standard Manufacturer QC'
        },
        deliveryRequirements: {
          sourcingPreference: Array.isArray(prodOpp.sourcingOptions) ? prodOpp.sourcingOptions.join(' + ') : 'Domestic + Import',
          destinations: Array.isArray(prodOpp.deliveryRegions) ? prodOpp.deliveryRegions : [],
          schedule: prodOpp.deliverySchedule || 'Staggered dispatch per buyer order schedule',
          dispatchWindow: prodOpp.defaultDeliveryWindow || '7-10 working days from confirmation',
          unloading: prodOpp.unloadingTerms || 'Direct dock unloading at buyer factory premises / regional hub',
          splitDeliveries: prodOpp.splitDeliveries || 'Accepted (per agreed lot sizes)',
          multipleLocations: prodOpp.multipleLocations || 'Yes — per buyer network',
          importTerms: prodOpp.incoterms || 'Standard Commercial Terms; Incoterms 2020'
        }
      },
      demandSummary: {
        buyerEnquiriesCount,
        totalPotentialQuantity,
        committedQuantity,
        orderedQuantity,
        interestedQuantity,
        deliveredQuantity,
        targetQuantity,
        quantityNeeded,
        demandProgressPercent,
        deliveryRegionsCount
      },
      buyerEnquiries: anonymizedEnquiries,
      availableOpportunities: allOpportunities,
      supplierOffers
    });
  } catch (err) {
    console.error('Error fetching opportunity data:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch opportunity data.' });
  }
});

/**
 * POST /api/collective-buying/supplier-offer
 * Records a supplier quotation directly into [CollectiveOffers] table in Azure SQL.
 */
router.post('/collective-buying/supplier-offer', async (req, res) => {
  try {
    const {
      opportunityId,
      productName,
      unitPrice,
      currency = 'INR',
      availableQuantity,
      moq,
      priceBreaks,
      taxes,
      freightBasis,
      leadTime,
      paymentTerms,
      offerValidity,
      origin,
      remarks,
      supplierName = 'Verified Supplier Partner',
      supplierEmail = 'supplier@synergy5m.com'
    } = req.body;

    const parsedPrice = parseFloat(unitPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive offered unit price is required.' });
    }

    const parsedAvailQty = parseFloat(availableQuantity);
    if (isNaN(parsedAvailQty) || parsedAvailQty < 0) {
      return res.status(400).json({ success: false, message: 'Available quantity cannot be negative.' });
    }

    const pool = await poolPromise;
    if (!pool) {
      return res.status(503).json({ success: false, message: 'Database service is currently unavailable.' });
    }

    const offerRef = `OFFER-S5M-${Date.now()}`;
    const offerRecord = {
      id: offerRef,
      opportunityId: opportunityId || '',
      productName: productName || 'Collective Buy Product',
      supplierName,
      supplierEmail,
      unitPrice: parseFloat(unitPrice),
      currency,
      availableQuantity: parseFloat(availableQuantity) || 0,
      moq: parseFloat(moq) || 0,
      priceBreaks: typeof priceBreaks === 'string' ? priceBreaks : JSON.stringify(priceBreaks || []),
      taxes: taxes || 'GST Extra as applicable',
      freightBasis: freightBasis || 'Ex-Works',
      leadTime: leadTime || '7-10 Days',
      paymentTerms: paymentTerms || '30 Days Net',
      offerValidity: offerValidity || '15 Days',
      origin: origin || 'Domestic',
      remarks: remarks || '',
      status: 'SUBMITTED',
      createdAt: new Date().toISOString()
    };

    await pool.request()
      .input('Id', sql.NVarChar, offerRecord.id)
      .input('OpportunityId', sql.NVarChar, offerRecord.opportunityId)
      .input('ProductName', sql.NVarChar, offerRecord.productName)
      .input('SupplierName', sql.NVarChar, offerRecord.supplierName)
      .input('SupplierEmail', sql.NVarChar, offerRecord.supplierEmail)
      .input('UnitPrice', sql.Decimal(18, 2), offerRecord.unitPrice)
      .input('Currency', sql.NVarChar, offerRecord.currency)
      .input('AvailableQuantity', sql.Decimal(18, 2), offerRecord.availableQuantity)
      .input('Moq', sql.Decimal(18, 2), offerRecord.moq)
      .input('PriceBreaks', sql.NVarChar(sql.MAX), offerRecord.priceBreaks)
      .input('Taxes', sql.NVarChar, offerRecord.taxes)
      .input('FreightBasis', sql.NVarChar, offerRecord.freightBasis)
      .input('LeadTime', sql.NVarChar, offerRecord.leadTime)
      .input('PaymentTerms', sql.NVarChar, offerRecord.paymentTerms)
      .input('OfferValidity', sql.NVarChar, offerRecord.offerValidity)
      .input('Origin', sql.NVarChar, offerRecord.origin)
      .input('Remarks', sql.NVarChar(sql.MAX), offerRecord.remarks)
      .input('OfferJson', sql.NVarChar(sql.MAX), JSON.stringify(offerRecord))
      .query(`
        INSERT INTO CollectiveOffers (
          Id, OpportunityId, ProductName, SupplierName, SupplierEmail,
          UnitPrice, Currency, AvailableQuantity, Moq, PriceBreaks,
          Taxes, FreightBasis, LeadTime, PaymentTerms, OfferValidity,
          Origin, Remarks, Status, OfferJson, CreatedAt, UpdatedAt
        ) VALUES (
          @Id, @OpportunityId, @ProductName, @SupplierName, @SupplierEmail,
          @UnitPrice, @Currency, @AvailableQuantity, @Moq, @PriceBreaks,
          @Taxes, @FreightBasis, @LeadTime, @PaymentTerms, @OfferValidity,
          @Origin, @Remarks, 'SUBMITTED', @OfferJson, GETDATE(), GETDATE()
        );
      `);

    return res.status(201).json({
      success: true,
      offerReference: offerRef,
      message: 'Quotation successfully registered and submitted for aggregation review.',
      savedToDb: true,
      data: offerRecord,
      submissionDate: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error submitting supplier offer:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit supplier offer. Please try again.' });
  }
});

module.exports = router;
