const nodemailer = require('nodemailer');

async function sendInvoiceEmail(toEmail, companyName, invoiceId, amount) {
  if (!toEmail) return;

  try {
    // Setup SMTP transporter (Configure these in your Render Env variables later)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER || 'test',
        pass: process.env.SMTP_PASS || 'test'
      }
    });
    
    await transporter.sendMail({
      from: '"Task Management System" <billing@tasksystem.com>',
      to: toEmail,
      subject: `New Invoice INV-${String(invoiceId).padStart(5, '0')} Generated`,
      text: `Hello ${companyName},\n\nA new recurring invoice for $${Number(amount).toFixed(2)} has been generated and is now due.\n\nPlease log in to the portal to view and download your invoice.\n\nThank you for your business!`
    });
    
    console.log(`[Email Success] Recurring Invoice sent to ${toEmail}`);
  } catch (err) {
    console.error('[Email Error] Failed to send email:', err.message);
  }
}

module.exports = { sendInvoiceEmail };