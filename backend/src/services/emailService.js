const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  auth: {
    user: process.env.SMTP_USER || 'test',
    pass: process.env.SMTP_PASS || 'test'
  }
});

async function sendInvoiceEmail(toEmail, companyName, invoiceId, amount) {
  if (!toEmail) return;
  try {
    await transporter.sendMail({
      from: '"Task Management System" <billing@tasksystem.com>',
      to: toEmail,
      subject: `New Invoice INV-${String(invoiceId).padStart(5, '0')} Generated`,
      text: `Hello ${companyName},\n\nA new recurring invoice for $${Number(amount).toFixed(2)} has been generated and is now due.\n\nPlease log in to the portal to view and download your invoice.\n\nThank you for your business!`
    });
  } catch (err) { console.error('[Email Error]', err.message); }
}

async function sendInvoiceReminderEmail(toEmail, companyName, invoiceId, amount, dueDate) {
  if (!toEmail) return;
  try {
    await transporter.sendMail({
      from: '"Task Management System Accounts" <billing@tasksystem.com>',
      to: toEmail,
      subject: `REMINDER: Outstanding Invoice INV-${String(invoiceId).padStart(5, '0')}`,
      text: `Hello ${companyName},\n\nThis is a friendly reminder that Invoice INV-${String(invoiceId).padStart(5, '0')} for $${Number(amount).toFixed(2)} was due on ${new Date(dueDate).toLocaleDateString()}.\n\nPlease arrange for payment as soon as possible to avoid service disruption.\n\nThank you.`
    });
  } catch (err) { console.error('[Email Error]', err.message); }
}

async function sendTaskReminderEmail(toEmail, empName, taskCode, scope, deadline) {
  if (!toEmail) return;
  try {
    const dateStr = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
    await transporter.sendMail({
      from: '"Task Management System" <tasks@tasksystem.com>',
      to: toEmail,
      subject: `ACTION REQUIRED: Approaching Deadline for Task ${taskCode}`,
      text: `Hi ${empName},\n\nThis is an automated reminder that your assigned task (${taskCode}) is approaching its deadline on ${dateStr}.\n\nScope: ${scope}\n\nPlease ensure you update the progress in the system.\n\nBest regards,\nOperations Team`
    });
  } catch (err) { console.error('[Email Error]', err.message); }
}

async function sendTaskCompletedEmail(toEmail, empName, taskCode, scope, isManager = false) {
  if (!toEmail) return;
  try {
    const subject = isManager 
      ? `Task ${taskCode} Completed by Team` 
      : `Confirmation: Task ${taskCode} Marked Completed`;
    
    const body = isManager
      ? `Hello,\n\nThe following task has been marked as Completed by the assigned team members:\n\nTask Code: ${taskCode}\nScope: ${scope}\n\nPlease review the deliverables.`
      : `Hi ${empName},\n\nThank you for completing your task.\n\nTask Code: ${taskCode}\nScope: ${scope}\n\nYour manager has been notified of your completion.\n\nGreat job!`;

    await transporter.sendMail({
      from: '"Task Management System" <tasks@tasksystem.com>',
      to: toEmail,
      subject,
      text: body
    });
  } catch (err) { console.error('[Email Error]', err.message); }
}

module.exports = { 
  sendInvoiceEmail, 
  sendInvoiceReminderEmail, 
  sendTaskReminderEmail, 
  sendTaskCompletedEmail 
};