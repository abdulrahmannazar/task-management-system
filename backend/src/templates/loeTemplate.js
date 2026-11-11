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
 * Parses raw scope strings into structured items (numbered points, sub-bullets, headings)
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
      // Check if sub-bullet (starts with 'o' or bullet symbol + tab/space)
      if (/^[oO][\s\t]+/.test(part)) {
        lines.push({
          type: 'sub',
          text: part.replace(/^[oO][\s\t]+/, '').trim()
        });
      } else if (/^\d+\.\d+\s+/.test(part)) {
        // Sub-heading like "2.1 Tax Return Preparation"
        lines.push({
          type: 'subheading',
          text: part
        });
      } else {
        // Main scope item
        const cleaned = part.replace(/^[-*•●▪♦\d.\s\t]+/, '').trim();
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
  const logoBannerDataUri = getLogoBannerDataUri();

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
      const billingType = item.service?.billing_type || loe?.billing_frequency || loe?.type || 'Monthly';
      serviceMap.set(sId, {
        serviceId: sId,
        name: item.service?.name || `Service #${sId}`,
        department: item.service?.department?.name || 'General',
        subCategory: item.service?.sub_category || '',
        billingType: billingType,
        billingRoutine: billingType,
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
  const statusStr = String(loe?.status || '').toLowerCase().trim();
  const isApproved = statusStr === 'approved';

  // Dynamic section numbering
  const infoSectionNum = serviceList.length + 1;
  const feesSectionNum = serviceList.length + 2;
  const paymentSectionNum = serviceList.length + 3;
  const limitationsSectionNum = serviceList.length + 4;
  const basisSectionNum = serviceList.length + 5;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Letter of Engagement - ${loeReference}</title>
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

    /* Universal typography: Same font and same font size throughout */
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

    /* Top Letterhead Banner - Centered, matching the uploaded design */
    .top-banner-container {
      text-align: center;
      margin-bottom: 20px;
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

    /* Date & Reference Row */
    .date-ref-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .ref-code {
      font-weight: bold;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    .recipient-block {
      margin-bottom: 14px;
      line-height: 1.4;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .subject-line {
      font-weight: bold;
      text-decoration: underline;
      margin-bottom: 14px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    p {
      margin: 0 0 10px 0;
      text-align: justify;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      orphans: 3;
      widows: 3;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .underlined-heading {
      font-weight: bold;
      text-decoration: underline;
      margin: 14px 0 8px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-heading {
      font-weight: bold;
      margin: 16px 0 6px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .sub-section-heading {
      font-weight: bold;
      margin: 10px 0 4px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-after: avoid;
      page-break-after: avoid;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Scope Lists - Prevents splitting lines across pages */
    .scope-ordered-list {
      margin: 4px 0 10px 0;
      padding-left: 24px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    .scope-ordered-list li {
      margin-bottom: 5px;
      text-align: justify;
      padding-left: 4px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .scope-sub-list {
      list-style-type: none;
      margin: 3px 0 6px 20px;
      padding: 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .scope-sub-list li {
      margin-bottom: 4px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .scope-sub-list li::before {
      content: "o  ";
      font-weight: bold;
    }

    .exclusion-list {
      margin: 4px 0 10px 24px;
      padding: 0;
      list-style-type: disc;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    .exclusion-list li {
      margin-bottom: 4px;
      padding-left: 4px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Professional Fees Table with Billing Routine Column */
    .fees-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
      margin: 10px 0 12px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .fees-table th,
    .fees-table td {
      border: 1px solid #000000;
      padding: 6px 10px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      vertical-align: middle;
    }

    .fees-table th {
      background-color: #f8fafc;
      font-weight: bold;
      text-align: left;
    }

    .fees-table td.center {
      text-align: center;
    }

    .fees-table td.right {
      text-align: right;
    }

    .fees-table tr.total-row td {
      font-weight: bold;
      background-color: #fafafa;
    }

    /* Fee Out-of-Pocket Expenses Note */
    .fee-note {
      font-style: italic;
      margin: 10px 0 14px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Signature Section */
    .signature-section {
      margin-top: 20px;
      break-inside: avoid;
      page-break-inside: avoid;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
    }

    /* Dynamic Semi-Transparent Watermark for Non-Approved LOEs */
    .watermark {
      position: fixed;
      top: 45%;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 58pt;
      font-family: 'Times New Roman', Times, serif;
      font-weight: bold;
      color: rgba(225, 29, 72, 0.12);
      transform: rotate(-45deg);
      pointer-events: none;
      z-index: 99999;
      letter-spacing: 6px;
      text-transform: uppercase;
    }

    .dotted-line {
      margin-top: 32px;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  ${!isApproved ? '<div class="watermark">PENDING APPROVAL</div>' : ''}

  <!-- Top Letterhead Banner (Exact design from uploaded image) -->
  ${
    logoBannerDataUri
      ? `<div class="top-banner-container">
           <img src="${logoBannerDataUri}" class="brand-banner-img" alt="Frontier Advisory" />
         </div>`
      : ''
  }

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

  <!-- Professional Fees with Billing Routine Column -->
  <div class="section-heading">
    ${feesSectionNum}. Professional Fees
  </div>
  <p style="margin-bottom: 8px;">
    Our professional fees for the above services will be charged as follows:
  </p>

  <table class="fees-table">
    <thead>
      <tr>
        <th style="width: 52%;">Service</th>
        <th style="width: 24%; text-align: center;">Billing Routine</th>
        <th style="width: 24%; text-align: right;">Professional Fee</th>
      </tr>
    </thead>
    <tbody>
      ${serviceList
        .map(
          (srv) => `
        <tr>
          <td>${srv.name}${srv.subCategory ? ` (${srv.subCategory})` : ''}</td>
          <td class="center">${srv.billingRoutine}</td>
          <td class="right">${formatFeeAmount(srv.amount)}</td>
        </tr>
      `
        )
        .join('')}
      ${
        serviceList.length > 1
          ? `
        <tr class="total-row">
          <td colspan="2"><strong>Total Agreed Professional Fee</strong></td>
          <td class="right"><strong>${formatFeeAmount(totalAmount)}</strong></td>
        </tr>
      `
          : ''
      }
    </tbody>
  </table>

  <!-- Mandatory Out-of-pocket Expenses Note -->
  <p class="fee-note">
    <strong>Note:</strong> The professional fees listed above exclude travel and other out-of-pocket expenses, which will be billed separately at actual cost upon client authorization.
  </p>

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
    Travel and other out-of-pocket expenses, if any, will be charged separately at cost upon client authorization.
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
    <div style="font-weight: bold;">Frontier Advisory (Private) Limited</div>

    <p style="margin-top: 28px;">We hereby agree to this Letter of Engagement</p>

    <div class="dotted-line">${loe?.client_signatory_name ? 'Digitally Signed & Accepted' : '……………………………'}</div>
    <div>Authorized Signatory on behalf of: <strong>${clientName}</strong></div>
    ${loe?.client_signatory_name ? `<div style="margin-top: 2px;">Name: <strong>${loe.client_signatory_name}</strong></div>` : ''}
    ${loe?.client_signatory_title ? `<div style="margin-top: 2px;">Designation: <strong>${loe.client_signatory_title}</strong></div>` : ''}
    <div style="margin-top: 4px;">Date: ${loe?.client_accepted_at ? formatOrdinalDate(loe.client_accepted_at) : '……………………………'}</div>
  </div>

</body>
</html>`;
};
