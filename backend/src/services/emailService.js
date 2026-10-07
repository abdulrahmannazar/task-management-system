/**
 * Email Service using EmailJS REST API (Port 443)
 * Dispatches internal notifications to Managers and Admins only.
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
  if (!toEmail) return;

  try {
    await sendViaEmailJS({ toEmail, subject, textContent });
    console.log(`[Email Success] Delivered to ${toEmail}`);
  } catch (err) {
    console.error(`[Email Error] Failed delivering to ${toEmail}:`, err.message);
  }
}

// ==========================================
// EXPORTED DISPATCH HANDLERS (MANAGERS & ADMINS)
// ==========================================

// 1. Alert Managers/Admins when a new LOE is created
async function sendLoeCreatedEmail(toEmail, recipientName, companyName, loeId, totalAmount) {
  const loeCode = `LOE-${String(loeId).padStart(5, '0')}`;
  const pdfUrl = `${BASE_URL}/api/loes/${loeId}/pdf`;

  const textContent = 
`Hello ${recipientName},

A new Letter of Engagement has been drafted and is awaiting your review and approval.

Engagement Summary:
- Reference: ${loeCode}
- Company: ${companyName}
- Total Value: $${Number(totalAmount).toFixed(2)}

Review or download the LOE PDF:
${pdfUrl}

Please log in to the portal to approve or reject the deliverables.`;

  await dispatchEmail({
    toEmail,
    subject: `Action Required: New ${loeCode} Created (${companyName})`,
    textContent
  });
}

// 2. Alert Managers/Admins when an LOE has been pending approval for > 2 days
async function sendLoePendingReminderEmail(toEmail, recipientName, companyName, loeId, daysPending) {
  const loeCode = `LOE-${String(loeId).padStart(5, '0')}`;
  const pdfUrl = `${BASE_URL}/api/loes/${loeId}/pdf`;

  const textContent = 
`Hello ${recipientName},

This is an automated reminder that ${loeCode} for ${companyName} has been pending approval for over ${daysPending} days without approval.

Details:
- Reference: ${loeCode}
- Company: ${companyName}
- Current Status: Approval Pending

Review the LOE PDF:
${pdfUrl}

Please review and take action in the portal to avoid delaying project onboarding.`;

  await dispatchEmail({
    toEmail,
    subject: `REMINDER: ${loeCode} Pending Approval (${companyName})`,
    textContent
  });
}

// 3. Alert Managers/Admins when an invoice is created
async function sendInvoiceCreatedEmail(toEmail, recipientName, companyName, invoiceId, amount, dueDate) {
  const invoiceCode = `INV-${String(invoiceId).padStart(5, '0')}`;
  const pdfUrl = `${BASE_URL}/api/invoices/${invoiceId}/pdf`;
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';

  const textContent = 
`Hello ${recipientName},

A new invoice has been generated.

Invoice Summary:
- Invoice Number: ${invoiceCode}
- Client: ${companyName}
- Total Due: $${Number(amount).toFixed(2)}
- Due Date: ${formattedDueDate}
- Status: Not Paid

Download Official Invoice PDF:
${pdfUrl}

The record has been logged in the portal under Invoices.`;

  await dispatchEmail({
    toEmail,
    subject: `Notice: New Invoice ${invoiceCode} Generated (${companyName})`,
    textContent
  });
}

// 4. Alert Managers/Admins regarding an unpaid invoice
async function sendInvoiceReminderEmail(toEmail, recipientName, companyName, invoiceId, amount, dueDate) {
  const invoiceCode = `INV-${String(invoiceId).padStart(5, '0')}`;
  const pdfUrl = `${BASE_URL}/api/invoices/${invoiceId}/pdf`;
  const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A';

  const textContent = 
`Hello ${recipientName},

This is a reminder regarding an outstanding unpaid invoice.

Invoice Details:
- Invoice Number: ${invoiceCode}
- Client Company: ${companyName}
- Amount Outstanding: $${Number(amount).toFixed(2)}
- Due Date: ${formattedDueDate}

Download Invoice PDF:
${pdfUrl}

Please follow up with the client or review payment collection.`;

  await dispatchEmail({
    toEmail,
    subject: `Unpaid Invoice Notice: ${invoiceCode} (${companyName})`,
    textContent
  });
}

// Task Reminders (For Staff)
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

async function verifyAndSendTestEmail(targetEmail) {
  const dest = targetEmail || 'rahmannazar000@gmail.com';
  await sendViaEmailJS({
    toEmail: dest,
    subject: 'Task System: EmailJS Connection Test',
    textContent: `EmailJS integration is operating correctly!\n\nDelivered to: ${dest}\nTimestamp: ${new Date().toISOString()}`
  });
  return { success: true, recipient: dest };
}

module.exports = { 
  verifyAndSendTestEmail,
  sendLoeCreatedEmail,
  sendLoePendingReminderEmail,
  sendInvoiceCreatedEmail,
  sendInvoiceReminderEmail, 
  sendTaskReminderEmail, 
  sendTaskCompletedEmail 
};