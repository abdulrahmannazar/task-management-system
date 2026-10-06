const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.EMAIL_USER;
  // Remove any whitespace that Google automatically formats into App Passwords
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : null;

  if (!user || !pass) {
    console.warn('[Email Warning] EMAIL_USER or EMAIL_PASS not set on this server. Email dispatch skipped.');
    return null;
  }

  // Use Port 587 with STARTTLS (bypasses port 465 timeout on cloud hosting)
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Must be false for 587 to allow STARTTLS negotiation
    requireTLS: true,
    family: 4, // Force IPv4 to avoid Render's IPv6 ENETUNREACH error
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000
  });
}

// Diagnostic test endpoint function
async function verifyAndSendTestEmail(targetEmail) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user) throw new Error('EMAIL_USER environment variable is missing on Render.');
  if (!pass) throw new Error('EMAIL_PASS environment variable is missing on Render.');

  const transporter = createTransporter();
  if (!transporter) throw new Error('Failed to initialize mail transporter.');

  // Test the SMTP handshake
  await transporter.verify();

  // Send test message
  const info = await transporter.sendMail({
    from: `"Task Management System" <${user}>`,
    to: targetEmail || user,
    subject: 'SMTP Test: Task Management System',
    text: `Your email notification integration is working correctly!\n\nSender: ${user}\nRecipient: ${targetEmail || user}\nTimestamp: ${new Date().toISOString()}`
  });

  return info;
}

async function sendInvoiceEmail(toEmail, companyName, invoiceId, amount) {
  if (!toEmail) return;
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `New Invoice INV-${String(invoiceId).padStart(5, '0')} Generated`,
      text: `Hello ${companyName},\n\nA new recurring invoice for $${Number(amount).toFixed(2)} has been generated and is now due.\n\nPlease log in to the portal to view and download your invoice.\n\nThank you for your business!`
    });
    console.log(`[Email Success] Invoice sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send invoice to ${toEmail}:`, err.message);
  }
}

async function sendInvoiceReminderEmail(toEmail, companyName, invoiceId, amount, dueDate) {
  if (!toEmail) return;
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: `"Task Management Accounts" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `REMINDER: Outstanding Invoice INV-${String(invoiceId).padStart(5, '0')}`,
      text: `Hello ${companyName},\n\nThis is a friendly reminder that Invoice INV-${String(invoiceId).padStart(5, '0')} for $${Number(amount).toFixed(2)} was due on ${new Date(dueDate).toLocaleDateString()}.\n\nPlease arrange for payment as soon as possible to avoid service disruption.\n\nThank you.`
    });
    console.log(`[Email Success] Invoice reminder sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send invoice reminder to ${toEmail}:`, err.message);
  }
}

async function sendTaskReminderEmail(toEmail, empName, taskCode, scope, deadline) {
  if (!toEmail) return;
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    const dateStr = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
    await transporter.sendMail({
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `ACTION REQUIRED: Approaching Deadline for Task ${taskCode}`,
      text: `Hi ${empName},\n\nThis is an automated reminder that your assigned task (${taskCode}) is approaching its deadline on ${dateStr}.\n\nScope: ${scope || 'Standard Deliverable'}\n\nPlease update your progress in the system.\n\nBest regards,\nOperations Team`
    });
    console.log(`[Email Success] Task reminder sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send task reminder to ${toEmail}:`, err.message);
  }
}

async function sendTaskCompletedEmail(toEmail, empName, taskCode, scope, isManager = false) {
  if (!toEmail) return;
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    const subject = isManager 
      ? `Task ${taskCode} Completed by Team` 
      : `Confirmation: Task ${taskCode} Marked Completed`;
    
    const body = isManager
      ? `Hello,\n\nThe following task has been marked as Completed by the assigned team:\n\nTask Code: ${taskCode}\nScope: ${scope || 'Standard Deliverable'}\n\nPlease review the deliverables in the system.`
      : `Hi ${empName},\n\nThank you for completing your task.\n\nTask Code: ${taskCode}\nScope: ${scope || 'Standard Deliverable'}\n\nYour manager has been notified.\n\nGreat job!`;

    await transporter.sendMail({
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text: body
    });
    console.log(`[Email Success] Completion notice sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send completion notice to ${toEmail}:`, err.message);
  }
}

module.exports = { 
  verifyAndSendTestEmail,
  sendInvoiceEmail, 
  sendInvoiceReminderEmail, 
  sendTaskReminderEmail, 
  sendTaskCompletedEmail 
};