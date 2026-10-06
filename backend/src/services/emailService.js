const nodemailer = require('nodemailer');

function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : null;

  if (!user || !pass) {
    console.warn('[Email Warning] EMAIL_USER or EMAIL_PASS not set in environment variables. Email dispatch skipped.');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4, // CRITICAL: Forces IPv4 to bypass Render's ENETUNREACH IPv6 issue
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
}

// Diagnostic test helper to verify credentials
async function verifyAndSendTestEmail(targetEmail) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('EMAIL_USER or EMAIL_PASS environment variable is missing on Render.');
  }

  const transporter = createTransporter();
  if (!transporter) throw new Error('Could not initialize mail transporter.');

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `"Task Management System" <${user}>`,
    to: targetEmail || user,
    subject: 'SMTP Test: Task Management System',
    text: `Your email setup is working correctly!\n\nSent from: ${user}\nTimestamp: ${new Date().toISOString()}`
  });

  return info;
}

async function sendInvoiceEmail(toEmail, companyName, invoiceId, amount) {
  if (!toEmail) {
    console.warn('[Email Warning] Recipient email is empty. Cannot send invoice.');
    return;
  }
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
    console.error(`[Email Error] Failed to send invoice email to ${toEmail}:`, err.message);
  }
}

async function sendInvoiceReminderEmail(toEmail, companyName, invoiceId, amount, dueDate) {
  if (!toEmail) {
    console.warn('[Email Warning] Company recipient email is empty. Cannot send invoice reminder.');
    return;
  }
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
  if (!toEmail) {
    console.warn(`[Email Warning] Employee email for ${empName} is empty. Cannot send task reminder.`);
    return;
  }
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    const dateStr = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
    await transporter.sendMail({
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: `ACTION REQUIRED: Approaching Deadline for Task ${taskCode}`,
      text: `Hi ${empName},\n\nThis is an automated reminder that your assigned task (${taskCode}) is approaching its deadline on ${dateStr}.\n\nScope: ${scope || 'Standard Deliverable'}\n\nPlease ensure you update the progress in the system.\n\nBest regards,\nOperations Team`
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
      ? `Hello,\n\nThe following task has been marked as Completed by the assigned team members:\n\nTask Code: ${taskCode}\nScope: ${scope || 'Standard Deliverable'}\n\nPlease review the deliverables in the system.`
      : `Hi ${empName},\n\nThank you for completing your task.\n\nTask Code: ${taskCode}\nScope: ${scope || 'Standard Deliverable'}\n\nYour manager has been notified of your completion.\n\nGreat job!`;

    await transporter.sendMail({
      from: `"Task Management System" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text: body
    });
    console.log(`[Email Success] Task completed notification sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed to send completion email to ${toEmail}:`, err.message);
  }
}

module.exports = { 
  verifyAndSendTestEmail,
  sendInvoiceEmail, 
  sendInvoiceReminderEmail, 
  sendTaskReminderEmail, 
  sendTaskCompletedEmail 
};