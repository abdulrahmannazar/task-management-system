/**
 * Generates an HTML document for the Letter of Engagement
 * @param {Object} data - Contains loe and company details
 * @returns {string} HTML string
 */
function renderLoeHtml({ loe, company }) {
  const formattedDate = loe.start_date
    ? new Date(loe.start_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

  const formattedEndDate = loe.end_date
    ? new Date(loe.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Ongoing / Project Completion';

  const items = loe.loe_items || [];

  const itemsRows = items.length > 0
    ? items.map((item, index) => `
        <tr>
          <td style="text-align: center; width: 40px;">${index + 1}</td>
          <td style="width: 35%;">
            <strong>${item.service?.name || 'Custom Service'}</strong>
            ${item.service?.sub_category ? `<br><small style="color: #666;">Classification: ${item.service.sub_category}</small>` : ''}
          </td>
          <td>${item.custom_scope || 'Standard operational scope as agreed.'}</td>
        </tr>
      `).join('')
    : `
        <tr>
          <td colspan="3" style="text-align: center; color: #777;">No individual service items listed.</td>
        </tr>
      `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Letter of Engagement - LOE #${loe.loe_id}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 18mm 20mm 18mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #222;
      font-size: 13px;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0056b3;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .company-title {
      font-size: 22px;
      font-weight: 700;
      color: #0056b3;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 12px;
      color: #666;
      margin: 2px 0 0 0;
    }
    .doc-badge {
      text-align: right;
    }
    .doc-type {
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #333;
      margin: 0;
    }
    .doc-ref {
      font-size: 12px;
      color: #555;
      margin: 4px 0 0 0;
    }
    .grid-info {
      width: 100%;
      margin-bottom: 24px;
      border-collapse: collapse;
    }
    .grid-info td {
      vertical-align: top;
      width: 50%;
    }
    .section-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 700;
      color: #0056b3;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .details-box {
      font-size: 12.5px;
      line-height: 1.5;
    }
    .details-box p {
      margin: 2px 0;
    }
    .content-block {
      margin-bottom: 20px;
    }
    .services-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 15px;
    }
    .services-table th {
      background-color: #f1f5f9;
      color: #333;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #cbd5e1;
      padding: 9px 10px;
      text-align: left;
    }
    .services-table td {
      border: 1px solid #cbd5e1;
      padding: 9px 10px;
      vertical-align: top;
      font-size: 12px;
    }
    .services-table tr:nth-child(even) {
      background-color: #fcfcfd;
    }
    .terms-box {
      background: #f8fafc;
      border-left: 3px solid #0056b3;
      padding: 10px 14px;
      font-size: 11px;
      color: #475569;
      margin-top: 20px;
      border-radius: 0 4px 4px 0;
    }
    .terms-box ol {
      margin: 4px 0 0 16px;
      padding: 0;
    }
    .terms-box li {
      margin-bottom: 4px;
    }
    .signature-table {
      width: 100%;
      margin-top: 40px;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .signature-table td {
      width: 50%;
      padding: 0 20px 0 0;
      vertical-align: top;
    }
    .sig-line {
      margin-top: 50px;
      border-top: 1px solid #475569;
      padding-top: 6px;
    }
    .sig-name {
      font-weight: bold;
      font-size: 12px;
      margin: 0;
    }
    .sig-sub {
      font-size: 11px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td>
        <h1 class="company-title">TASK MANAGEMENT SYSTEMS</h1>
        <p class="subtitle">Enterprise Engagement &amp; Professional Services</p>
      </td>
      <td class="doc-badge">
        <h2 class="doc-type">Letter of Engagement</h2>
        <p class="doc-ref">Ref: <strong>LOE-${loe.loe_id}</strong> | Date: ${formattedDate}</p>
        <p class="doc-ref">Status: <strong>${loe.status || 'Draft'}</strong></p>
      </td>
    </tr>
  </table>

  <!-- Parties Info -->
  <table class="grid-info">
    <tr>
      <td>
        <div class="section-title">Client Information</div>
        <div class="details-box">
          <p><strong>Name:</strong> ${company?.name || 'N/A'}</p>
          <p><strong>Client Type:</strong> ${company?.client_type || 'Corporate'}</p>
          ${company?.reg_number ? `<p><strong>Reg Number:</strong> ${company.reg_number}</p>` : ''}
          ${company?.tin_number ? `<p><strong>TIN:</strong> ${company.tin_number}</p>` : ''}
          ${company?.email ? `<p><strong>Email:</strong> ${company.email}</p>` : ''}
          ${company?.phone_number ? `<p><strong>Phone:</strong> ${company.phone_number}</p>` : ''}
        </div>
      </td>
      <td style="padding-left: 20px;">
        <div class="section-title">Engagement Details</div>
        <div class="details-box">
          <p><strong>Engagement ID:</strong> #${loe.loe_id}</p>
          <p><strong>Engagement Type:</strong> ${loe.type || 'Standard'}</p>
          <p><strong>Commencement Date:</strong> ${formattedDate}</p>
          <p><strong>Target Completion:</strong> ${formattedEndDate}</p>
        </div>
      </td>
    </tr>
  </table>

  <!-- Scope Introduction -->
  <div class="content-block">
    <p>Dear Client,</p>
    <p>
      We are pleased to confirm our acceptance and our understanding of this engagement through this formal Letter of Engagement. 
      The services to be performed and their respective contractual scopes are itemized below:
    </p>

    <!-- Services Table without Amount -->
    <table class="services-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Service / Classification</th>
          <th>Scope of Work &amp; Deliverables</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>
  </div>

  <!-- Standard Terms -->
  <div class="terms-box">
    <strong>Terms &amp; General Conditions:</strong>
    <ol>
      <li>The services outlined above shall be provided in accordance with the specified scope and schedule.</li>
      <li>Any revisions, additions, or modifications to the scope of work must be agreed upon in writing by both parties.</li>
    </ol>
  </div>

  <!-- Signatures Block -->
  <table class="signature-table">
    <tr>
      <td>
        <p style="margin: 0; font-size: 11px; color: #475569;">Accepted and Agreed on behalf of:</p>
        <p style="margin: 3px 0 0; font-weight: bold;">${company?.name || 'The Client'}</p>
        <div class="sig-line">
          <p class="sig-name">Authorized Signatory</p>
          <p class="sig-sub">Date: ________________________</p>
        </div>
      </td>
      <td>
        <p style="margin: 0; font-size: 11px; color: #475569;">Signed and Authorized by:</p>
        <p style="margin: 3px 0 0; font-weight: bold;">TASK MANAGEMENT SYSTEM</p>
        <div class="sig-line">
          <p class="sig-name">Engagement Director / Manager</p>
          <p class="sig-sub">Date: ${formattedDate}</p>
        </div>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

module.exports = { renderLoeHtml };