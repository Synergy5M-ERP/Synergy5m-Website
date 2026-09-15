require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const nodemailer = require('nodemailer');
const multer = require('multer'); // npm install multer
const upload = multer({ storage: multer.memoryStorage() }); // Keep files in memory buffer
const router = express.Router();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: true, enableArithAbort: true }
};

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * 1. Endpoint to fetch vendors for the selection list
 * (Fixes the 404 Not Found error on GET /api/vendors)
 */
router.get('/api/vendors', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const search = req.query.search || '';
        const industry = req.query.industry || '';
        const category = req.query.category || '';

        const request = new sql.Request();
        request.input('search', sql.VarChar, `%${search}%`);
        request.input('industry', sql.VarChar, industry);
        request.input('category', sql.VarChar, category);

        let query = `
            SELECT Id, Company_Name, Email, Contact_Number, GST_Number, Contact_Person, industry, Category 
            FROM [dbo].[Potential_Vendor]
            WHERE (Company_Name LIKE @search OR Email LIKE @search OR GST_Number LIKE @search)
        `;

        if (industry) {
            query += ` AND industry = @industry`;
        }
        if (category) {
            query += ` AND Category = @category`;
        }

        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Database fetch error:', err);
        res.status(500).json({ success: false, message: 'Database error while fetching vendors.' });
    }
});

// Endpoint to fetch unique Industries and Categories for dropdown filters
router.get('/api/vendor-filters', async (req, res) => {
    try {
        await sql.connect(dbConfig);
        const request = new sql.Request();
        
        const industriesResult = await request.query('SELECT DISTINCT industry FROM [dbo].[Potential_Vendor] WHERE industry IS NOT NULL AND industry != \'\'');
        const categoriesResult = await request.query('SELECT DISTINCT Category FROM [dbo].[Potential_Vendor] WHERE Category IS NOT NULL AND Category != \'\'');

        res.json({
            success: true,
            industries: industriesResult.recordset.map(r => r.industry),
            categories: categoriesResult.recordset.map(r => r.Category)
        });
    } catch (err) {
        console.error('Filter fetch error:', err);
        res.status(500).json({ success: false, message: 'Error fetching filters.' });
    }
});


/**
 * 2. Endpoint to send plain text email with file attachment and dynamic signatures
 */
router.post('/api/send-vendor-emails-attachment', upload.single('attachment'), async (req, res) => {
    const { vendorIds, subject, bodyTemplate } = req.body;
    const attachmentFile = req.file; // Attached file buffer

    if (!vendorIds) {
        return res.status(400).json({ success: false, message: 'No vendor IDs provided.' });
    }

    // Parse vendorIds if sent as a JSON string or array
    const parsedIds = typeof vendorIds === 'string' ? JSON.parse(vendorIds) : vendorIds;

    try {
        await sql.connect(dbConfig);
        const safeIds = parsedIds.map(id => parseInt(id)).filter(id => !isNaN(id)).join(',');
        if (!safeIds) return res.status(400).json({ success: false, message: 'Invalid vendor IDs.' });

        const request = new sql.Request();
        const result = await request.query(`SELECT Id, Company_Name, Email, Contact_Person, GST_Number FROM [dbo].[Potential_Vendor] WHERE Id IN (${safeIds})`);
        const vendors = result.recordset;

        let sentCount = 0;
        let failedCount = 0;

        for (const vendor of vendors) {
            if (!vendor.Email || vendor.Email.trim() === '') {
                failedCount++;
                continue;
            }

            // Replace plain text tokens dynamically per vendor
            let personalizedBody = bodyTemplate
                .replace(/{{Company_Name}}/g, vendor.Company_Name || '')
                .replace(/{{Contact_Person}}/g, vendor.Contact_Person || 'Valued Partner')
                .replace(/{{GST_Number}}/g, vendor.GST_Number || 'N/A');

            let mailOptions = {
                from: `"Synergy 5M" <${process.env.SMTP_USER}>`,
                to: vendor.Email,
                subject: subject,
                text: personalizedBody // Sent strictly as plain text
            };

            // Attach file if provided
            if (attachmentFile) {
                mailOptions.attachments = [{
                    filename: attachmentFile.originalname,
                    content: attachmentFile.buffer
                }];
            }

            try {
                await transporter.sendMail(mailOptions);
                sentCount++;
            } catch (mailErr) {
                console.error(`Failed sending to ${vendor.Email}:`, mailErr.message);
                failedCount++;
            }
        }

        res.json({ success: true, message: `Dispatched successfully. Sent: ${sentCount}, Failed: ${failedCount}` });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

module.exports = router;