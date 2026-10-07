/**
 * Email Service using EmailJS REST API (Port 443)
 * Dispatches notification emails and PDF access links.
 */

const BASE_URL = process.env.BACKEND_URL || 'https://task-management-system-6ifq.onrender.com';

async function sendViaEmailJS({ toEmail, subject, textContent }) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error('EmailJS environment variables are missing on the server.');
  }

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    accessToken: privateKey,
    template_params: {
      to_email: toEmail,
      subject: subject,
      message: textContent
    }
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EmailJS responded with ${response.status}: ${errorText}`);
  }

  return true;
}

async function dispatchEmail({ toEmail, subject, textContent }) {
  if (!toEmail) {
    console.warn('[Email Warning] No recipient email specified.');
    return;
  }

  try {
    await sendViaEmailJS({ toEmail, subject, textContent });
    console.log(`[Email Success] Delivered to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed delivering to ${toEmail}:`, err.message);
  }
}

// ==========================================
// EXPORTED DISPATCH HANDLERS
// ==========================================

async function verifyAndSendTestEmail(targetEmail) {
  const dest = targetEmail || 'rahmannazar000@gmail.com';
  await sendViaEmailJS({
    toEmail: dest,
    subject: 'Task System: EmailJS Connection Test',
    textContent: `EmailJS integration is operating correctly!\n\nDelivered to: ${dest}\nTimestamp: ${new Date().toISOString()}`
  });
  return { success: true, recipient: dest };
}

// 1. SIMPLE UNPAID INVOICE REMINDER WITH PDF
async function sendInvoiceReminderEmail(toEmail, companyName, invoiceId, amount, dueDate) {
  const invoiceCode = `INV-${String(invoiceId).padStart(5, '0')}`;
  const pdfDownloadUrl = `${BASE_URL}/api/invoices/${invoiceId}/pdf`;
  const formattedDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'Immediate';

  const textContent = 
`Hello ${companyName},

You have an unpaid invoice.

Invoice Details:
- Invoice Number: ${invoiceCode}
- Amount Due: $${Number(amount).toFixed(2)}
- Due Date: ${formattedDate}

Download your official invoice PDF here:
${pdfDownloadUrl}

Please arrange for payment at your earliest convenience.

Thank you!`;

  await dispatchEmail({
    toEmail,
    subject: `Notice: You have an unpaid invoice (${invoiceCode})`,
    textContent
  });
}

// 2. NEW INVOICE GENERATION EMAIL WITH PDF
async function sendInvoiceEmail(toEmail, companyName, invoiceId, amount) {
  const invoiceCode = `INV-${String(invoiceId).padStart(5, '0')}`;
  const pdfDownloadUrl = `${BASE_URL}/api/invoices/${invoiceId}/pdf`;

  const textContent = 
`Hello ${companyName},

A new invoice has been generated for your account.

Invoice Details:
- Invoice Number: ${invoiceCode}
- Total Amount: $${Number(amount).toFixed(2)}

Download your official invoice PDF here:
${pdfDownloadUrl}

Please log in or review the attached link to complete your payment.

Thank you!`;

  await dispatchEmail({
    toEmail,
    subject: `New Invoice Generated: ${invoiceCode}`,
    textContent
  });
}

// 3. LOE APPROVED EMAIL WITH PDF
async function sendLoeApprovedEmail(toEmail, companyName, loeId) {
  const loeCode = `LOE-${String(loeId).padStart(5, '0')}`;
  const pdfDownloadUrl = `${BASE_URL}/api/loes/${loeId}/pdf`;

  const textContent = 
`Hello ${companyName},

Your Letter of Engagement has been officially approved.

LOE Details:
- Reference: ${loeCode}
- Approval Date: ${new Date().toLocaleDateString()}

Download and review your approved Letter of Engagement PDF here:
${pdfDownloadUrl}

Our team has initiated work on your project according to the agreed scopes.

Thank you for your business!`;

  await dispatchEmail({
    toEmail,
    subject: `Approved: Letter of Engagement ${loeCode}`,
    textContent
  });
}

// Task Handlers
async function sendTaskReminderEmail(toEmail, empName, taskCode, scope, deadline) {
  const dateStr = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
  await dispatchEmail({
    toEmail,
    subject: `ACTION REQUIRED: Approaching Deadline for Task ${taskCode}`,
    textContent: `Hi ${empName},\n\nThis is a reminder that your assigned task (${taskCode}) is approaching its deadline on ${dateStr}.\n\nScope: ${scope || 'Standard Deliverable'}\n\nPlease update your progress in the system.\n\nBest regards,\nOperations Team`
  });
}

async function sendTaskCompletedEmail(toEmail, empName, taskCode, scope, isManager = false) {
  const subject = isManager 
    ? `Task ${taskCode} Completed by Team` 
    : `Confirmation: Task ${taskCode} Marked Completed`;
  
  const textContent = isManager
    ? `Hello,\n\nThe team has marked Task ${taskCode} as Completed:\n\nScope: ${scope || 'Standard Deliverable'}\n\nPlease review the deliverables in the system.`
    : `Hi ${empName},\n\nThank you for completing your task.\n\nTask Code: ${taskCode}\nScope: ${scope || 'Standard Deliverable'}\n\nYour manager has been notified.\n\nGreat job!`;

  await dispatchEmail({ toEmail, subject, textContent });
}

module.exports = { 
  verifyAndSendTestEmail,
  sendInvoiceEmail, 
  sendInvoiceReminderEmail, 
  sendLoeApprovedEmail,
  sendTaskReminderEmail, 
  sendTaskCompletedEmail 
};