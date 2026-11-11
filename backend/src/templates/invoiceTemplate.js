const fs = require('fs');
const path = require('path');

/**
 * Locates the official company banner (frontier_logo_banner.png)
 * and converts it into a Base64 Data URI for reliable PDF rendering.
 */
function getLogoBannerDataUri() {
  const candidatePaths = [
    path.join(__dirname, 'frontier_logo_banner.png'),
    path.join(__dirname, 'logo_banner.png'),
    path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'frontier_logo_banner.png'),
    'C:/Users/User/.gemini/antigravity/brain/f79569a1-caf8-44b3-9bc0-bfb06754954c/.user_uploaded/media_1794398640085_e80fae76.png',
    path.join(__dirname, 'logo.png')
  ];

  for (const filePath of candidatePaths) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const base64 = fs.readFileSync(filePath).toString('base64');
        return `data:${mime};base64,${base64}`;
      }
    } catch (err) {}
  }
  return null;
}

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

function extractBulletPoints(scopesArray) {
  const result = [];
  (scopesArray || []).forEach((rawScope) => {
    if (!rawScope) return;
    const parts = String(rawScope)
      .replace(/&bull;/gi, '•')
      .split(/\r?\n|[\u2022\u2023\u25E6\u2043\u2219•●▪♦]|\s+o\s+|\b(?=\d+\.\s+)/)
      .map((s) => s.replace(/^[-*•●▪♦\d.\s\t]+/, '').trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

    result.push(...parts);
  });
  return result.length > 0 ? result : ['Standard Deliverable'];
}

module.exports = function generateInvoiceTemplate({ invoice, loe, company }) {
  const currencyCode = loe?.currency || 'LKR';
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const logoBannerDataUri = getLogoBannerDataUri();

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
      const billingType = item.service?.billing_type || loe?.billing_frequency || loe?.type || 'Monthly';
      serviceMap.set(sId, {
        name: item.service?.name || `Service #${sId}`,
        department: item.service?.department?.name || 'General',
        subCategory: item.service?.sub_category || '',
        billingRoutine: billingType,
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin-top: 20mm;
      margin-bottom: 22mm;
      margin-left: 18mm;
      margin-right: 18mm;
    }

    * {
      box-sizing: border-box;
    }

    /* Universal typography matching LOE: Same font and same font size throughout */
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      color: #000000;
      line-height: 1.45;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Top Letterhead Banner - Centered, matching LOE exactly */
    .top-banner-container {
      text-align: center;
      margin-bottom: 18px;
      padding-bottom: 4px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .brand-banner-img {
      width: 380px;
      max-width: 90%;
      height: auto;
      display: inline-block;
    }

    /* Header Bar */
    .invoice-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1.5px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 16px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .invoice-title {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      font-weight: bold;
      border: 1px solid ${invoice.status === 'Paid' ? '#059669' : '#b91c1c'};
      background: ${invoice.status === 'Paid' ? '#ecfdf5' : '#fff1f2'};
      color: ${invoice.status === 'Paid' ? '#047857' : '#be123c'};
    }

    /* Billed To and Details Grid */
    .grid-info {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .box-info {
      flex: 1;
      background: #fafafa;
      border: 1px solid #000000;
      padding: 10px 12px;
      line-height: 1.4;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    .box-title {
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 6px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    /* Deliverables Table with Billing Routine Column */
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
      margin-top: 14px;
      margin-bottom: 12px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    table.invoice-table th,
    table.invoice-table td {
      border: 1px solid #000000;
      padding: 6px 10px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      vertical-align: top;
    }

    table.invoice-table th {
      background-color: #f8fafc;
      font-weight: bold;
      text-align: left;
    }

    table.invoice-table td.center {
      text-align: center;
    }

    table.invoice-table td.right {
      text-align: right;
    }

    .scope-list {
      margin: 6px 0 0 0;
      padding-left: 18px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      list-style-type: disc;
    }

    .scope-list li {
      margin-bottom: 4px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Out of pocket expenses Note */
    .fee-note {
      font-style: italic;
      margin: 10px 0 14px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Total Section */
    .total-section {
      margin-top: 14px;
      border: 1.5px solid #000000;
      background: #fafafa;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .total-amount {
      font-weight: bold;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    .remittance-box {
      margin-top: 16px;
      padding: 10px 14px;
      border: 1px dashed #64748b;
      background: #ffffff;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    p, li, tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- Top Letterhead Banner (Exact design from uploaded image) -->
  ${
    logoBannerDataUri
      ? `<div class="top-banner-container">
           <img src="${logoBannerDataUri}" class="brand-banner-img" alt="Frontier Advisory" />
         </div>`
      : ''
  }

  <!-- Header Row with Title and Status -->
  <div class="invoice-header">
    <div>
      <div class="invoice-title">Official Tax Invoice</div>
      <div style="margin-top: 3px;">Invoice No: <strong>${invoiceNumber}</strong></div>
    </div>
    <div style="text-align: right;">
      <span class="status-badge">${invoice.status.toUpperCase()}</span>
      <div style="margin-top: 3px;">Currency: <strong>${currencyCode} (${currencySymbol})</strong></div>
    </div>
  </div>

  <!-- Billed To & Invoice Details Grid -->
  <div class="grid-info">
    <div class="box-info">
      <div class="box-title">Billed To:</div>
      <div><strong>${company?.name || 'N/A'}</strong></div>
      <div>Reg No: ${company?.reg_number || company?.reg_no || 'N/A'}</div>
      <div>TIN: ${company?.tin_number || company?.tin_no || 'N/A'}</div>
      <div>Email: ${company?.email || 'N/A'}</div>
      <div>Phone: ${company?.phone_number || company?.phone || 'N/A'}</div>
    </div>
    <div class="box-info">
      <div class="box-title">Invoice Details:</div>
      <div><strong>Issue Date:</strong> ${formatDate(invoice.issued_date)}</div>
      <div><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</div>
      <div><strong>Billing Type:</strong> ${loe?.type || 'Adhoc'} (${loe?.billing_frequency || 'One-Time'})</div>
      <div><strong>Payment Terms:</strong> 15 Days from Invoice Date</div>
    </div>
  </div>

  <!-- Deliverables & Professional Fees Table with Billing Routine Column -->
  <table class="invoice-table">
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">#</th>
        <th style="width: 53%;">Service &amp; Scope of Work</th>
        <th style="width: 20%; text-align: center;">Billing Routine</th>
        <th style="width: 22%; text-align: right;">Amount (${currencyCode})</th>
      </tr>
    </thead>
    <tbody>
      ${serviceList.map((srv, idx) => {
        const cleanBullets = extractBulletPoints(srv.scopes);
        const deptInfo = srv.subCategory
          ? `${srv.department} – ${srv.subCategory}`
          : srv.department;

        return `
          <tr>
            <td class="center" style="font-weight: bold;">${idx + 1}</td>
            <td>
              <div>
                <strong>${srv.name}</strong>
                <span style="color: #475569;"> (${deptInfo})</span>
              </div>
              <ul class="scope-list">
                ${cleanBullets.map(pt => `<li>${pt}</li>`).join('')}
              </ul>
            </td>
            <td class="center">${srv.billingRoutine}</td>
            <td class="right" style="font-weight: bold;">
              ${formatCurrency(srv.amount)}
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <!-- Mandatory Out-of-pocket Expenses Note -->
  <p class="fee-note">
    <strong>Note:</strong> The professional fees listed above exclude travel and other out-of-pocket expenses, which will be billed separately at actual cost upon client authorization.
  </p>

  <!-- Total Section -->
  <div class="total-section">
    <div>Please remit payment in <strong>${currencyCode} (${currencySymbol})</strong></div>
    <div class="total-amount">Total Due: ${formatCurrency(invoice.total_amount)}</div>
  </div>

  <!-- Remittance Information -->
  <div class="remittance-box">
    <strong>Bank Remittance Details:</strong><br/>
    Bank: Commercial Bank of Ceylon PLC | Branch: Colombo 04 Branch<br/>
    Account Name: Frontier Advisory (Private) Limited | Account No: 1000185934<br/>
    Please include Invoice Reference <strong>${invoiceNumber}</strong> with your payment confirmation.
  </div>

</body>
</html>`;
};
