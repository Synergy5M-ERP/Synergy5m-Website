require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const axios = require('axios'); // npm install axios
const router = express.Router();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: true, enableArithAbort: true }
};

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Endpoint to broadcast WhatsApp messages to multiple selected vendors
 */
router.post('/api/whatsapp/broadcast', async (req, res) => {
    const { vendorIds, message } = req.body;

    if (!vendorIds) {
        return res.status(400).json({ success: false, message: 'No vendor IDs provided.' });
    }

    // Parse vendorIds if sent as a JSON string or array
    const parsedIds = typeof vendorIds === 'string' ? JSON.parse(vendorIds) : vendorIds;

    try {
        await sql.connect(dbConfig);
        const safeIds = parsedIds.map(id => parseInt(id)).filter(id => !isNaN(id)).join(',');
        
        if (!safeIds) {
            return res.status(400).json({ success: false, message: 'Invalid vendor IDs.' });
        }

        // Fetch vendor details from SQL database (pulling Contact_Number / Phone)
        const request = new sql.Request();
        const result = await request.query(`SELECT Id, Company_Name, Contact_Number, Contact_Person FROM [dbo].[Potential_Vendor] WHERE Id IN (${safeIds})`);
        const vendors = result.recordset;

        let sentCount = 0;
        let failedCount = 0;
        const details = [];

        for (const vendor of vendors) {
            // Ensure phone number exists
            if (!vendor.Contact_Number || vendor.Contact_Number.trim() === '') {
                failedCount++;
                details.push({ vendorName: vendor.Company_Name, success: false, error: 'Missing phone number' });
                continue;
            }

            // Clean phone number format (Meta expects digits only without '+' sign)
            const cleanPhone = vendor.Contact_Number.replace(/[^0-9]/g, '');

            // Personalize tokens dynamically per vendor
            let personalizedBody = message
                .replace(/{{Company_Name}}/g, vendor.Company_Name || '')
                .replace(/{{Contact_Person}}/g, vendor.Contact_Person || 'Valued Partner');

            try {
                // Dispatch text message via Meta WhatsApp Cloud API
                const response = await axios.post(
                    `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
                    {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: cleanPhone,
                        type: 'text',
                        text: { body: personalizedBody }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                sentCount++;
                details.push({ vendorName: vendor.Company_Name, success: true, messageId: response.data.messages[0].id });
            } catch (whatsappErr) {
                console.error(`Failed sending WhatsApp to ${vendor.Company_Name}:`, whatsappErr.response?.data || whatsappErr.message);
                failedCount++;
                details.push({ 
                    vendorName: vendor.Company_Name, 
                    success: false, 
                    error: whatsappErr.response?.data?.error?.message || whatsappErr.message 
                });
            }

            // Small delay between requests to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        res.json({ 
            success: true, 
            message: `WhatsApp broadcast completed. Sent: ${sentCount}, Failed: ${failedCount}`,
            results: details 
        });

    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during WhatsApp broadcast.' });
    }
});

module.exports = router;