/**
 * Generates HTML for the official Tax & Commercial Invoice PDF
 */
module.exports = function generateInvoiceTemplate({ invoice, loe, company }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Group items by service to present consolidated billable line items
  const serviceMap = new Map();
  (loe.loe_items || []).forEach((item) => {
    const sId = item.service_id;
    if (!serviceMap.has(sId)) {
      serviceMap.set(sId, {
        name: item.service?.name || `Service #${sId}`,
        department: item.service?.department?.name || 'General',
        billingType: item.service?.billing_type || 'Fixed Fee',
        amount: Number(item.amount || item.service?.price || 0),
        scopes: []
      });
    }
    if (item.custom_scope) {
      serviceMap.get(sId).scopes.push(item.custom_scope);
    }
  });

  const lineItems = Array.from(serviceMap.values());
  const invoiceNumber = `INV-${String(invoice.invoice_id).padStart(5, '0')}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm;
    }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #2d3748;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .header-table {
      width: 100%;
      border-bottom: 3px solid #2b6cb0;
      padding-bottom: 14px;
      margin-bottom: 22px;
    }
    .invoice-title {
      font-size: 26px;
      font-weight: 800;
      color: #1a365d;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .invoice-subtitle {
      font-size: 13px;
      color: #718096;
      margin: 4px 0 0 0;
    }
    .status-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: bold;
      padding: 4px 12px;
      border-radius: 4px;
      background: #e6fffa;
      color: #234e52;
      border: 1px solid #b2f5ea;
      text-transform: uppercase;
    }
    .info-grid {
      width: 100%;
      margin-bottom: 25px;
      border-collapse: collapse;
    }
    .info-card {
      width: 48%;
      vertical-align: top;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
    }
    .card-heading {
      font-size: 11.5px;
      font-weight: 700;
      color: #2b6cb0;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-bottom: 8px;
    }
    .card-row {
      margin-bottom: 4px;
      font-size: 12.5px;
    }
    .card-label {
      font-weight: 600;
      color: #718096;
      width: 110px;
      display: inline-block;
    }
    .table-container {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .table-container th {
      background: #2b6cb0;
      color: #ffffff;
      text-align: left;
      padding: 9px 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .table-container td {
      border-bottom: 1px solid #e2e8f0;
      padding: 10px;
      vertical-align: top;
      font-size: 12.5px;
    }
    .table-container tr:nth-child(even) td {
      background: #fafbfc;
    }
    .scopes-list {
      margin: 4px 0 0 0;
      padding-left: 16px;
      color: #718096;
      font-size: 11.5px;
    }
    .summary-table {
      width: 45%;
      margin-left: auto;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .summary-table td {
      padding: 8px 10px;
      font-size: 13px;
    }
    .summary-total {
      border-top: 2px solid #2b6cb0;
      border-bottom: 2px solid #2b6cb0;
      font-weight: 800;
      font-size: 15px;
      color: #1a365d;
      background: #edf2f7;
    }
    .remittance-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      margin-top: 30px;
      font-size: 12px;
      color: #4a5568;
      page-break-inside: avoid;
    }
    .remittance-title {
      font-weight: 700;
      text-transform: uppercase;
      color: #2b6cb0;
      margin-bottom: 6px;
    }
    .footer-note {
      text-align: center;
      margin-top: 35px;
      font-size: 11.5px;
      color: #a0aec0;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td>
        <h1 class="invoice-title">Tax &amp; Commercial Invoice</h1>
        <p class="invoice-subtitle">Official billing statement for professional services rendered</p>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div class="status-badge">${invoice.status || 'Issued'}</div>
        <div style="font-size: 15px; font-weight: bold; color: #1a365d; margin-top: 6px;">${invoiceNumber}</div>
      </td>
    </tr>
  </table>

  <!-- Billing & Metadata Grid -->
  <table class="info-grid">
    <tr>
      <td class="info-card">
        <div class="card-heading">Billed To (Client Details)</div>
        <div class="card-row"><span class="card-label">Company:</span> <strong>${company?.name || 'N/A'}</strong></div>
        <div class="card-row"><span class="card-label">Client Type:</span> ${company?.client_type || 'Corporate'}</div>
        <div class="card-row"><span class="card-label">Reg Number:</span> ${company?.reg_number || 'N/A'}</div>
        <div class="card-row"><span class="card-label">TIN Number:</span> ${company?.tin_number || 'N/A'}</div>
        <div class="card-row"><span class="card-label">Email:</span> ${company?.email || 'N/A'}</div>
        <div class="card-row"><span class="card-label">Phone:</span> ${company?.phone_number || 'N/A'}</div>
      </td>
      <td style="width: 4%;"></td>
      <td class="info-card">
        <div class="card-heading">Invoice Summary</div>
        <div class="card-row"><span class="card-label">Invoice Ref:</span> <strong>${invoiceNumber}</strong></div>
        <div class="card-row"><span class="card-label">LOE Contract:</span> LOE #${loe.loe_id}</div>
        <div class="card-row"><span class="card-label">Issue Date:</span> ${formatDate(invoice.issued_date)}</div>
        <div class="card-row"><span class="card-label">Due Date:</span> <strong>${formatDate(invoice.due_date)}</strong></div>
        <div class="card-row"><span class="card-label">Engagement:</span> ${loe.type || 'Standard'}</div>
        <div class="card-row"><span class="card-label">Currency:</span> USD ($)</div>
      </td>
    </tr>
  </table>

  <!-- Line Items Table -->
  <table class="table-container">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 55%;">Service Deliverable &amp; Scope Summary</th>
        <th style="width: 20%;">Billing Terms</th>
        <th style="width: 20%; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineItems.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${item.name}</strong>
            <span style="color: #718096; font-size: 11.5px;">(${item.department})</span>
            ${item.scopes.length > 0 ? `
              <ul class="scopes-list">
                ${item.scopes.map(s => `<li>${s}</li>`).join('')}
              </ul>
            ` : '<div style="font-size: 11.5px; color: #718096; margin-top: 3px;">Contracted scope deliverables.</div>'}
          </td>
          <td>${item.billingType}</td>
          <td style="text-align: right; font-weight: 600;">$${formatCurrency(item.amount)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Totals Calculation -->
  <table class="summary-table">
    <tr>
      <td style="color: #718096;">Subtotal:</td>
      <td style="text-align: right; font-weight: 600;">$${formatCurrency(invoice.total_amount)}</td>
    </tr>
    <tr>
      <td style="color: #718096;">Tax / VAT (0%):</td>
      <td style="text-align: right; font-weight: 600;">$0.00</td>
    </tr>
    <tr class="summary-total">
      <td>Total Amount Due:</td>
      <td style="text-align: right;">$${formatCurrency(invoice.total_amount)}</td>
    </tr>
  </table>

  <!-- Payment Instructions -->
  <div class="remittance-box">
    <div class="remittance-title">Remittance &amp; Payment Details</div>
    <div>Please remit payment within 30 days of invoice issuance quoting <strong>${invoiceNumber}</strong>.</div>
    <div style="margin-top: 4px;">Bank: <strong>Commercial Enterprise Banking</strong> | Account: <strong>XXXX-XXXX-XXXX-8921</strong> | Routing: <strong>021000089</strong></div>
  </div>

  <div class="footer-note">
    Thank you for your business. For billing inquiries, contact finance@company.com.
  </div>

</body>
</html>
  `;
};