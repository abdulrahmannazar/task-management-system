/**
 * Email Service using EmailJS REST API (Port 443)
 * Operates over HTTPS to bypass Render's outbound SMTP block.
 */

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
    accessToken: privateKey, // Required for server-side authorization
    template_params: {
      to_email: toEmail,
      subject: subject,
      message: textContent
    }
  };

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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
    console.log(`[Email Success] Delivered via EmailJS to ${toEmail}`);
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

async function sendInvoiceEmail(toEmail, companyName, invoiceId, amount) {
  await dispatchEmail({
    toEmail,
    subject: `New Invoice INV-${String(invoiceId).padStart(5, '0')} Generated`,
    textContent: `Hello ${companyName},\n\nA new recurring invoice for $${Number(amount).toFixed(2)} has been generated and is now due.\n\nPlease log in to view and download your invoice.\n\nThank you for your business!`
  });
}

async function sendInvoiceReminderEmail(toEmail, companyName, invoiceId, amount, dueDate) {
  await dispatchEmail({
    toEmail,
    subject: `REMINDER: Outstanding Invoice INV-${String(invoiceId).padStart(5, '0')}`,
    textContent: `Hello ${companyName},\n\nThis is a friendly reminder that Invoice INV-${String(invoiceId).padStart(5, '0')} for $${Number(amount).toFixed(2)} was due on ${new Date(dueDate).toLocaleDateString()}.\n\nPlease arrange for payment as soon as possible.\n\nThank you.`
  });
}

async function sendTaskReminderEmail(toEmail, empName, taskCode, scope, deadline) {
  const dateStr = deadline ? new Date(deadline).toLocaleDateString() : 'N/A';
  await dispatchEmail({
    toEmail,
    subject: `ACTION REQUIRED: Approaching Deadline for Task ${taskCode}`,
    textContent: `Hi ${empName},\n\nThis is an automated reminder that your assigned task (${taskCode}) is approaching its deadline on ${dateStr}.\n\nScope: ${scope || 'Standard Deliverable'}\n\nPlease update your progress in the system.\n\nBest regards,\nOperations Team`
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
  sendTaskReminderEmail, 
  sendTaskCompletedEmail 
};