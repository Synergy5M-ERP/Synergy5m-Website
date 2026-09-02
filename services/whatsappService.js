const twilio = require("twilio");

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send WhatsApp notification to Admin/Sales team
 */
async function sendDemoWhatsAppAlert(demoDetails) {
  const {
    id,
    fullName,
    businessEmail,
    companyName,
    officialMobile,
    preferredDate,
    timeSlot,
    meetingPlatform,
    requirement,
  } = demoDetails;

  const whatsappBody = 
`📌 *New Demo Booking Alert!*

A new user has submitted a demo request:

• *Demo ID:* #${id}
• *Status:* Pending
• *Name:* ${fullName}
• *Company:* ${companyName}
• *Email:* ${businessEmail}
• *Contact:* ${officialMobile}
• *Preferred Date:* ${preferredDate}
• *Time Slot:* ${timeSlot}
• *Platform:* ${meetingPlatform}
• *Requirement:* ${requirement || "None"}

Please review in portal and schedule the session.`;

  return twilioClient.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${process.env.ADMIN_WHATSAPP_NUMBER}`, // e.g. +9198XXXXXXXX
    body: whatsappBody,
  });
}

module.exports = { sendDemoWhatsAppAlert };