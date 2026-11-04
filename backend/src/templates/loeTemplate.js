const fs = require('fs');
const path = require('path');

/**
 * Automatically locates logo.jpg from common project directories
 * and converts it into a Base64 Data URI for Puppeteer PDF rendering.
 */
function getLogoDataUri() {
  const candidatePaths = [
    path.join(__dirname, 'logo.jpg'),
    path.join(__dirname, 'logo.jpeg'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, '..', 'assets', 'logo.jpg'),
    path.join(__dirname, '..', '..', 'logo.jpg'),
    path.join(__dirname, '..', '..', 'public', 'logo.jpg'),
    path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'logo.jpg'),
    path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'assets', 'logo.jpg')
  ];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const base64 = fs.readFileSync(filePath).toString('base64');
        return `data:${mime};base64,${base64}`;
      }
    } catch (err) {
      // Continue checking next path
    }
  }
  return null;
}

/**
 * Formats a date with an ordinal day suffix (e.g., "21st September 2026")
 */
function formatOrdinalDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  if (isNaN(d.getTime())) return 'N/A';

  const day = d.getDate();
  const month = d.toLocaleString('en-GB', { month: 'long' });
  const year = d.getFullYear();

  const getOrdinalSuffix = (n) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${day}${getOrdinalSuffix(day)} ${month} ${year}`;
}

/**
 * Parses raw scope strings into structured items (numbered points, sub-bullets 'o', or headings)
 */
function parseStructuredScopes(scopesArray) {
  const lines = [];

  (scopesArray || []).forEach((rawScope) => {
    if (!rawScope) return;

    const splitParts = String(rawScope)
      .replace(/&bull;/gi, '•')
      .split(/\r?\n|(?=[•●▪♦\u2022])|\b(?=\d+\.\s+)/)
      .map((s) => s.trim())
      .filter(Boolean);

    splitParts.forEach((part) => {
      // Check if sub-bullet (starts with 'o ' or 'O ')
      if (/^[oO]\s+/.test(part)) {
        lines.push({
          type: 'sub',
          text: part.replace(/^[oO]\s+/, '').trim()
        });
      } else if (/^\d+\.\d+\s+/.test(part)) {
        // Sub-heading like "2.1 Tax Return Preparation"
        lines.push({
          type: 'subheading',
          text: part
        });
      } else {
        // Main numbered scope item
        const cleaned = part.replace(/^[-*•●▪♦\d.\s]+/, '').trim();
        if (cleaned) {
          lines.push({
            type: 'main',
            text: cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
          });
        }
      }
    });
  });

  if (lines.length === 0) {
    lines.push({ type: 'main', text: 'Standard professional services as agreed.' });
  }

  return lines;
}

module.exports = function generateLoeTemplate({ loe, company }) {
  const currencyCode = loe?.currency || 'LKR';
  const logoDataUri = getLogoDataUri();

  const formatFeeAmount = (val) => {
    const num = Number(val || 0);
    const hasDecimals = num % 1 !== 0;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${currencyCode} ${formatted}`;
  };

  // Group LOE items by service
  const serviceMap = new Map();
  (loe?.loe_items || []).forEach((item) => {
    const sId = item.service_id;
    if (!serviceMap.has(sId)) {
      serviceMap.set(sId, {
        serviceId: sId,
        name: item.service?.name || `Service #${sId}`,
        department: item.service?.department?.name || 'General',
        subCategory: item.service?.sub_category || '',
        billingType: item.service?.billing_type || 'Fixed',
        amount: Number(item.amount || item.service?.price || 0),
        scopes: []
      });
    }
    if (item.custom_scope) {
      serviceMap.get(sId).scopes.push(item.custom_scope);
    }
  });

  const serviceList = Array.from(serviceMap.values());
  const totalAmount = serviceList.reduce((acc, srv) => acc + srv.amount, 0);

  const loeReference = loe?.loe_code
    ? loe.loe_code
    : `#${String(loe?.loe_id || 1).padStart(7, '0')}`;

  const clientName = company?.name || company?.company_name || 'The Client';

  // Dynamic section numbering after the service phases
  const infoSectionNum = serviceList.length + 1;
  const feesSectionNum = serviceList.length + 2;
  const paymentSectionNum = serviceList.length + 3;
  const limitationsSectionNum = serviceList.length + 4;
  const basisSectionNum = serviceList.length + 5;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Letter of Engagement - ${loeReference}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 15mm 22mm 15mm;
    }

    body {
      font-family: 'Times New Roman', Times, serif;
      color: #000000;
      margin: 0;
      padding: 0;
      font-size: 12pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Fixed Footer on Every Page */
    .page-footer {
      position: fixed;
      bottom: -14mm;
      left: 0;
      right: 0;
      height: 16mm;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 38px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8.5pt;
      color: #231e20;
      background: #ffffff;
      padding-top: 4px;
    }

    .footer-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .footer-icon {
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }

    .footer-text {
      line-height: 1.25;
    }

    /* Top Letterhead Banner (Page 1) */
    .letterhead-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 18px;
      padding-bottom: 6px;
    }

    .brand-logo {
      width: 54px;
      height: 54px;
      object-fit: contain;
    }

    .brand-text-wrap {
      text-align: left;
    }

    .brand-title {
      font-family: 'Times New Roman', Times, serif;
      font-size: 21pt;
      font-weight: bold;
      color: #056492;
      letter-spacing: 1.5px;
      margin: 0;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9.5pt;
      color: #5f5f5f;
      letter-spacing: 1.1px;
      margin: 3px 0 0 0;
    }

    /* Date & Reference Row */
    .date-ref-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .ref-code {
      font-weight: bold;
      font-size: 11pt;
    }

    .recipient-block {
      margin-bottom: 16px;
      line-height: 1.4;
    }

    .subject-line {
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 14px;
    }

    p {
      margin: 0 0 12px 0;
      text-align: justify;
    }

    .underlined-heading {
      font-weight: bold;
      text-decoration: underline;
      margin: 16px 0 10px 0;
    }

    .section-heading {
      font-weight: bold;
      margin: 18px 0 8px 0;
      page-break-after: avoid;
    }

    .sub-section-heading {
      font-weight: bold;
      margin: 12px 0 6px 0;
      page-break-after: avoid;
    }

    /* Scope Lists */
    .scope-ordered-list {
      margin: 6px 0 12px 0;
      padding-left: 24px;
    }

    .scope-ordered-list li {
      margin-bottom: 6px;
      text-align: justify;
      padding-left: 4px;
    }

    .scope-sub-list {
      list-style-type: none;
      margin: 4px 0 8px 22px;
      padding: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10.5pt;
    }

    .scope-sub-list li {
      margin-bottom: 4px;
    }

    .scope-sub-list li::before {
      content: "o  ";
    }

    /* Standard Bullet List (Section 6) */
    .exclusion-list {
      margin: 6px 0 12px 24px;
      padding: 0;
      list-style-type: disc;
    }

    .exclusion-list li {
      margin-bottom: 5px;
      padding-left: 4px;
    }

    /* Classic Double-Bordered Professional Fees Table */
    .fees-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 2px;
      border: 1.5px solid #000000;
      margin: 10px 0 16px 0;
      page-break-inside: auto;
    }

    .fees-table tr {
      page-break-inside: avoid;
    }

    .fees-table th,
    .fees-table td {
      border: 1px solid #000000;
      padding: 6px 8px;
      font-weight: bold;
      font-size: 11.5pt;
      vertical-align: top;
    }

    .fees-table th {
      text-align: left;
    }

    /* Signature Section */
    .signature-section {
      margin-top: 22px;
      page-break-inside: avoid;
    }

    .dotted-line {
      margin-top: 36px;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>

  <!-- Running Contact Footer (Appears at the bottom of every page) -->
  <div class="page-footer">
    <div class="footer-item">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="#167faa">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
      <div class="footer-text">
        15/1D, Joseph's Lane,<br/>
        Colombo 04
      </div>
    </div>

    <div class="footer-item">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="#167faa">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
      <div class="footer-text">
        +94 115 925 233<br/>
        +94 112 500 117
      </div>
    </div>

    <div class="footer-item">
      <svg class="footer-icon" viewBox="0 0 24 24" fill="#167faa">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
      <div class="footer-text">
        www.frontierlk.com<br/>
        info@frontierlk.com
      </div>
    </div>
  </div>

  <!-- Top Letterhead Banner -->
  <div class="letterhead-banner">
    ${
      logoDataUri
        ? `<img src="${logoDataUri}" class="brand-logo" alt="Frontier Advisory Logo" />`
        : ''
    }
    <div class="brand-text-wrap">
      <div class="brand-title">FRONTIER ADVISORY</div>
      <div class="brand-subtitle">Credible Solutions for Business Growth</div>
    </div>
  </div>

  <!-- Date and Reference Code -->
  <div class="date-ref-row">
    <div>${formatOrdinalDate(loe?.start_date)},</div>
    <div class="ref-code">${loeReference}</div>
  </div>

  <!-- Recipient -->
  <div class="recipient-block">
    The Directors,<br/>
    ${clientName},
  </div>

  <!-- Subject -->
  <div class="subject-line">
    Subject: Engagement Letter for the Provision of Professional Services
  </div>

  <!-- Opening Paragraph -->
  <p>
    We refer to your request with regard to the aforementioned subject and would like to thank you for providing
    Frontier Advisory (Private) Limited the opportunity to serve you.
  </p>

  <!-- About Us -->
  <div class="underlined-heading">About Us</div>
  <p>
    Frontier Advisory (Private) Limited (“We”) is a leading financial advisory company which has been in
    operation for the past 10 years. We have provided various types of financial services to clients both locally
    and internationally. Our Local &amp; International clients include HNB, Transco Cargo, Transco Travels,
    Melbn, Roar, Tesco, Nokia, Barath Electronics, PBL Transport, Sunray, Next BT, Docomo Intertouch,
    Parley, Pernod Ricard, China National Cable Corporation, UPL Lanka, Guild Gem, Probuild Engineering,
    Fire-X Project, Ceylon Artisans, Windsor Castle, CR Exports, C1 Hotel and Hostel, MSN Labs, Bungy
    Lanka, Wendroff &amp; Associates, A. O. Smith Water Products, Canadian Chamber of Commerce etc.
  </p>

  <!-- Scope of Work Section -->
  <div class="underlined-heading">
    Our scope of work will be carried out in the following phases:
  </div>

  ${serviceList
    .map((srv, idx) => {
      const parsedItems = parseStructuredScopes(srv.scopes);

      // Group items into ordered lists and sub-lists
      let htmlBlocks = '';
      let inOrderedList = false;
      let inSubList = false;

      parsedItems.forEach((item) => {
        if (item.type === 'subheading') {
          if (inSubList) {
            htmlBlocks += '</ul>';
            inSubList = false;
          }
          if (inOrderedList) {
            htmlBlocks += '</ol>';
            inOrderedList = false;
          }
          htmlBlocks += `<div class="sub-section-heading">${item.text}</div>`;
        } else if (item.type === 'sub') {
          if (!inSubList) {
            htmlBlocks += '<ul class="scope-sub-list">';
            inSubList = true;
          }
          htmlBlocks += `<li>${item.text}</li>`;
        } else {
          if (inSubList) {
            htmlBlocks += '</ul>';
            inSubList = false;
          }
          if (!inOrderedList) {
            htmlBlocks += '<ol class="scope-ordered-list">';
            inOrderedList = true;
          }
          htmlBlocks += `<li>${item.text}</li>`;
        }
      });

      if (inSubList) htmlBlocks += '</ul>';
      if (inOrderedList) htmlBlocks += '</ol>';

      return `
        <div class="section-heading">
          ${idx + 1}. ${srv.name}${srv.subCategory ? ` – ${srv.subCategory}` : ''}
        </div>
        <p style="margin-bottom: 6px;">The scope of work will include the following:</p>
        ${htmlBlocks}
      `;
    })
    .join('')}

  <!-- Information and Assistance from the Client -->
  <div class="section-heading">
    ${infoSectionNum}. Information and Assistance from the Client
  </div>
  <p>
    The Company/Liquidator will be responsible for providing us with timely access to the RAMIS system
    and all relevant financial, accounting and tax records required to perform the above services.
  </p>
  <p>
    The Company/Liquidator shall also provide the necessary authorisations, explanations, supporting
    documents and management representations required for the preparation and submission of tax returns and
    correspondence with the IRD.
  </p>
  <p>
    The Company will be responsible for the accuracy and completeness of the information and supporting
    documents provided to us.
  </p>

  <!-- Professional Fees -->
  <div class="section-heading">
    ${feesSectionNum}. Professional Fees
  </div>
  <p style="margin-bottom: 8px;">
    Our professional fees for the above services will be charged as follows:
  </p>

  <table class="fees-table">
    <thead>
      <tr>
        <th style="width: 72%;">Service</th>
        <th style="width: 28%;">Professional Fee</th>
      </tr>
    </thead>
    <tbody>
      ${serviceList
        .map(
          (srv) => `
        <tr>
          <td>${srv.name}${srv.subCategory ? ` (${srv.subCategory})` : ''}</td>
          <td>${formatFeeAmount(srv.amount)}</td>
        </tr>
      `
        )
        .join('')}
      ${
        serviceList.length > 1
          ? `
        <tr>
          <td>Total Agreed Professional Fee</td>
          <td>${formatFeeAmount(totalAmount)}</td>
        </tr>
      `
          : ''
      }
    </tbody>
  </table>

  <p>
    Any additional work arising from complex assessments, extensive IRD investigations, appeals, objections
    or matters requiring substantial additional professional time will be discussed and agreed separately with
    the Company prior to commencement.
  </p>
  <p>
    Government fees, taxes, penalties, interest and other statutory payments payable to the IRD will be borne
    directly by the Company.
  </p>
  <p>
    Travel and other out-of-pocket expenses, if any, will be charged separately at cost.
  </p>

  <!-- Payment Terms -->
  <div class="section-heading">
    ${paymentSectionNum}. Payment Terms
  </div>
  <p>
    The professional fees for the engagement will be invoiced upon commencement of the engagement
    (${loe?.type || 'Adhoc'} – ${loe?.billing_frequency || 'One-Time'} billing).
  </p>
  <p>
    All invoices are payable within 15 days from the date of invoice.
  </p>

  <!-- Scope Limitations -->
  <div class="section-heading">
    ${limitationsSectionNum}. Scope Limitations
  </div>
  <p style="margin-bottom: 6px;">
    Our engagement is limited to the services specifically described in this Letter of Engagement.
  </p>
  <p style="margin-bottom: 6px;">
    The following services are excluded unless separately agreed in writing:
  </p>
  <ul class="exclusion-list">
    <li>Preparation or reconstruction of accounting records or financial statements.</li>
    <li>Preparation of tax returns where significant reconstruction of accounting records is required.</li>
    <li>Representation in tax appeals or litigation before the Tax Appeals Commission or courts.</li>
    <li>Detailed tax investigations or forensic investigations.</li>
    <li>Payment of taxes, penalties, interest or other amounts payable to the IRD.</li>
    <li>Government or third-party fees and charges.</li>
    <li>Any other work outside the scope specified in this Letter of Engagement.</li>
  </ul>
  <p>
    Where any additional work is required, we will discuss the requirements and applicable fees with the
    Company before commencing such work.
  </p>

  <!-- Basis of Our Engagement -->
  <div class="section-heading">
    ${basisSectionNum}. Basis of Our Engagement
  </div>
  <p>
    Our services will be performed based on the information and records made available to us by the
    Company and information accessible through the RAMIS system and the IRD.
  </p>
  <p>
    We will not be responsible for delays arising from the Company's failure to provide information,
    supporting documents or authorisations, or delays in processing by the IRD.
  </p>
  <p>
    Our engagement does not constitute an audit or assurance engagement, and we do not provide assurance
    regarding the completeness or accuracy of information maintained by the IRD or provided by the
    Company.
  </p>

  <!-- Sign-Off & Acceptance Block -->
  <div class="signature-section">
    <p>Please do not hesitate to contact us for any further clarifications.</p>
    <p style="margin-top: 14px;">Yours Sincerely,</p>

    <div class="dotted-line">……………………………</div>
    <div>Frontier Advisory (Private) Limited</div>

    <p style="margin-top: 28px;">We hereby agree to this Letter of Engagement</p>

    <div class="dotted-line">……………………………</div>
    <div>Authorized Signatory on behalf of: ${clientName}</div>
    <div style="margin-top: 4px;">Date:</div>
  </div>

</body>
</html>
  `;
};