require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const nodemailer = require('nodemailer');
const multer = require('multer');

const upload = multer({ 
    limits: { 
        fieldSize: 50 * 1024 * 1024, // 50MB limit for text fields like rich-text HTML
        fileSize: 10 * 1024 * 1024   // 10MB limit for file attachments
    } 
});
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
 */
router.get('/api/vendors', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const search = req.query.search || '';
        const industry = req.query.industry || '';
        const category = req.query.category || '';

        const request = pool.request();
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
        let pool = await sql.connect(dbConfig);
        const request = pool.request();
        
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

// Endpoint to delete a specific email dispatch item record by its Id
router.delete('/api/email-dispatch-items/:id', async (req, res) => {
    const itemId = req.params.id;

    if (!itemId || isNaN(itemId)) {
        return res.status(400).json({ success: false, message: 'Invalid or missing Item ID.' });
    }

    try {
        let pool = await sql.connect(dbConfig);
        const request = pool.request();
        request.input('id', sql.Int, itemId);

        const result = await request.query(`
            DELETE FROM [dbo].[Email_Dispatch_Items] 
            WHERE Id = @id
        `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Record not found.' });
        }

        res.json({ success: true, message: 'Record deleted successfully.' });
    } catch (err) {
        console.error('Error deleting email dispatch item:', err);
        res.status(500).json({ success: false, message: 'Internal server error while deleting record.' });
    }
});

router.post('/api/send-vendor-emails-attachment', upload.single('attachment'), async (req, res) => {
    const { vendorIds, subject, bodyTemplate } = req.body;
    const attachmentFile = req.file;

    if (!vendorIds) {
        return res.status(400).json({ success: false, message: 'No vendor IDs provided.' });
    }

    let parsedIds;
    try {
        parsedIds = typeof vendorIds === 'string' ? JSON.parse(vendorIds) : vendorIds;
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid vendorIds format.' });
    }

    try {
        let pool = await sql.connect(dbConfig);
        const safeIds = parsedIds.map(id => parseInt(id)).filter(id => !isNaN(id)).join(',');
        if (!safeIds) {
            return res.status(400).json({ success: false, message: 'Invalid vendor IDs.' });
        }

        const vendorResult = await pool.request().query(
            `SELECT Id, Company_Name, Email, Contact_Person, GST_Number, industry, Category 
             FROM [dbo].[Potential_Vendor] WHERE Id IN (${safeIds})`
        );
        const vendors = vendorResult.recordset;

        let sentCount = 0;
        let failedCount = 0;
        const trackingDetails = [];

        for (const vendor of vendors) {
            let status = 'Sent';
            if (!vendor.Email || vendor.Email.trim() === '') {
                failedCount++;
                status = 'Failed';
                trackingDetails.push({ vendor, status });
                continue;
            }

            let personalizedBody = (bodyTemplate || '')
                .replace(/{{Company_Name}}/g, vendor.Company_Name || '')
                .replace(/{{Contact_Person}}/g, vendor.Contact_Person || 'Valued Partner')
                .replace(/{{GST_Number}}/g, vendor.GST_Number || 'N/A');

            let mailOptions = {
                from: `"Synergy 5M" <${process.env.SMTP_USER}>`,
                to: vendor.Email,
                subject: subject || 'Notification',
                html: personalizedBody,
                attachDataUrls: true
            };

            if (attachmentFile) {
                mailOptions.attachments = [{
                    filename: attachmentFile.originalname,
                    content: attachmentFile.buffer
                }];
            }

            try {
                await transporter.sendMail(mailOptions);
                sentCount++;
                status = 'Sent';
            } catch (mailErr) {
                console.error(`Failed sending to ${vendor.Email}:`, mailErr.message);
                failedCount++;
                status = 'Failed';
            }

            trackingDetails.push({ vendor, status });
        }

        // --- SQL TRANSACTION FOR LOGGING ---
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const logRequest = new sql.Request(transaction);
            logRequest.input('subject', sql.NVarChar, subject || 'No Subject');
            logRequest.input('sentCount', sql.Int, sentCount);
            logRequest.input('failedCount', sql.Int, failedCount);

            const logResult = await logRequest.query(`
                INSERT INTO [dbo].[Email_Dispatch_Logs] (Subject, Total_Sent, Total_Failed, Dispatched_At)
                OUTPUT INSERTED.Id
                VALUES (@subject, @sentCount, @failedCount, GETDATE())
            `);
            const newLogId = logResult.recordset[0].Id;

            for (const item of trackingDetails) {
                const itemRequest = new sql.Request(transaction);
                itemRequest.input('logId', sql.Int, newLogId);
                itemRequest.input('vendorId', sql.Int, item.vendor.Id);
                itemRequest.input('companyName', sql.NVarChar, item.vendor.Company_Name || '');
                itemRequest.input('email', sql.NVarChar, item.vendor.Email || '');
                itemRequest.input('industry', sql.NVarChar, item.vendor.industry || '');
                itemRequest.input('category', sql.NVarChar, item.vendor.Category || '');
                itemRequest.input('status', sql.NVarChar, item.status);

                await itemRequest.query(`
                    INSERT INTO [dbo].[Email_Dispatch_Items] (Log_Id, Vendor_Id, Company_Name, Email, Industry, Category, Status)
                    VALUES (@logId, @vendorId, @companyName, @email, @industry, @category, @status)
                `);
            }

            await transaction.commit();
        } catch (txnErr) {
            await transaction.rollback();
            console.error('Transaction Rollback Error:', txnErr);
            return res.status(500).json({ success: false, message: 'Database dispatch logging failed.' });
        }

        res.json({ success: true, message: `Dispatched successfully. Sent: ${sentCount}, Failed: ${failedCount}` });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});
router.get('/api/email-templates', async (req, res) => {
    // Return your email templates logic or array here
    res.json({ success: true, data: [] });
});
// Single unified endpoint for fetching email dispatch history
router.get('/api/email-dispatch-history', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        const result = await pool.request().query(`
            SELECT 
                i.Id AS Id,            
                l.Id AS Batch_Id,
                l.Subject,
                l.Dispatched_At,
                i.Vendor_Id,
                i.Company_Name,
                i.Email,
                i.Industry,
                i.Category,
                i.Status
            FROM [dbo].[Email_Dispatch_Logs] l
            JOIN [dbo].[Email_Dispatch_Items] i ON l.Id = i.Log_Id
            ORDER BY l.Dispatched_At DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error('Error fetching dispatch history:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

module.exports = router;