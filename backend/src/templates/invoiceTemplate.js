/**
 * Generates HTML for the Official Invoice PDF with selected LOE currency
 */
const CURRENCY_SYMBOLS = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$'
};

module.exports = function generateInvoiceTemplate({ invoice, loe, company }) {
  const currencyCode = loe?.currency || 'LKR';
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (val) => {
    const formatted = Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${currencySymbol} ${formatted}`;
  };

  const serviceMap = new Map();
  (loe?.loe_items || []).forEach((item) => {
    const sId = item.service_id;
    if (!serviceMap.has(sId)) {
      serviceMap.set(sId, {
        name: item.service?.name || `Service #${sId}`,
        department: item.service?.department?.name || 'General',
        amount: Number(item.amount || 0),
        scopes: []
      });
    }
    if (item.custom_scope) {
      serviceMap.get(sId).scopes.push(item.custom_scope);
    }
  });

  const serviceList = Array.from(serviceMap.values());
  const invoiceNumber = `INV-${String(invoice.invoice_id).padStart(5, '0')}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2d3748; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 24px; }
    .title { font-size: 26px; font-weight: bold; color: #0f172a; margin: 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; background: ${invoice.status === 'Paid' ? '#d4edda' : '#fee2e2'}; color: ${invoice.status === 'Paid' ? '#155724' : '#991b1b'}; }
    .grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
    .box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; vertical-align: top; }
    .total-section { margin-top: 24px; text-align: right; background: #f1f5f9; padding: 16px; border-radius: 6px; }
    .total-amount { font-size: 18px; font-weight: bold; color: #0f172a; }
    .footer { margin-top: 40px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">INVOICE</h1>
      <div style="margin-top: 4px; color: #475569;">Invoice No: <strong>${invoiceNumber}</strong></div>
    </div>
    <div style="text-align: right;">
      <span class="badge">${invoice.status.toUpperCase()}</span>
      <div style="margin-top: 6px; font-size: 12px;"><strong>Currency:</strong> ${currencyCode} (${currencySymbol})</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div style="font-weight: bold; margin-bottom: 6px; color: #0f172a;">Billed To:</div>
      <div><strong>${company?.name || 'N/A'}</strong></div>
      <div>Reg No: ${company?.reg_no || 'N/A'}</div>
      <div>Email: ${company?.email || 'N/A'}</div>
      <div>Phone: ${company?.phone || 'N/A'}</div>
    </div>
    <div class="box">
      <div style="font-weight: bold; margin-bottom: 6px; color: #0f172a;">Invoice Details:</div>
      <div><strong>Issue Date:</strong> ${formatDate(invoice.issued_date)}</div>
      <div><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</div>
      <div><strong>Billing Type:</strong> ${loe?.type || 'Adhoc'} (${loe?.billing_frequency || 'One-Time'})</div>
      <div><strong>Payment Currency:</strong> ${currencyCode} (${currencySymbol})</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Service</th>
        <th style="width: 45%;">Deliverables / Description</th>
        <th style="width: 25%; text-align: right;">Amount (${currencyCode})</th>
      </tr>
    </thead>
    <tbody>
      ${serviceList.map(srv => `
        <tr>
          <td>
            <strong>${srv.name}</strong><br/>
            <span style="color: #64748b; font-size: 11px;">${srv.department}</span>
          </td>
          <td>${srv.scopes.join(', ') || 'Standard Deliverable'}</td>
          <td style="text-align: right; font-weight: bold;">${formatCurrency(srv.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="total-section">
    <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">Please remit payment in <strong>${currencyCode}</strong></div>
    <div class="total-amount">Total Due: ${formatCurrency(invoice.total_amount)}</div>
  </div>

  <div class="footer">
    Thank you for your business. Please include Invoice Reference <strong>${invoiceNumber}</strong> with your payment.
  </div>
</body>
</html>
  `;
};