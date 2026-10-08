/**
 * Generates HTML for the Letter of Engagement (LOE) PDF including pricing schedules
 */
module.exports = function generateLoeTemplate({ loe, company }) {
  // Format Date Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Format Currency Helper
  const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Group LOE items by Service so each service displays its deliverables and agreed fee cleanly
  const serviceMap = new Map();
  (loe.loe_items || []).forEach((item) => {
    const sId = item.service_id;
    if (!serviceMap.has(sId)) {
      serviceMap.set(sId, {
        serviceId: sId,
        name: item.service?.name || `Service #${sId}`,
        department: item.service?.department?.name || 'General',
        subCategory: item.service?.sub_category || '',
        billingType: item.service?.billing_type || 'Fixed Fee',
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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Letter of Engagement - ${loe.loe_code || 'LOE #' + loe.loe_id}</title>
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
      border-bottom: 2px solid #2b6cb0;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header-title {
      font-size: 22px;
      font-weight: bold;
      color: #1a365d;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-subtitle {
      font-size: 13px;
      color: #4a5568;
      margin: 4px 0 0 0;
    }
    .ref-badge {
      font-size: 13px;
      font-weight: bold;
      background: #edf2f7;
      color: #2b6cb0;
      padding: 5px 12px;
      border-radius: 4px;
      display: inline-block;
    }
    .details-grid {
      width: 100%;
      margin-bottom: 25px;
      border-collapse: collapse;
    }
    .details-card {
      width: 48%;
      vertical-align: top;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: bold;
      color: #2b6cb0;
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
    .services-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      margin-bottom: 20px;
    }
    .services-table th {
      background: #2b6cb0;
      color: #ffffff;
      text-align: left;
      padding: 8px 10px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .services-table td {
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 10px;
      vertical-align: top;
      font-size: 12.5px;
    }
    .services-table tr:nth-child(even) td {
      background: #fcfdfe;
    }
    .scope-list {
      margin: 6px 0 0 0;
      padding-left: 18px;
      color: #4a5568;
      font-size: 12px;
    }
    .scope-list li {
      margin-bottom: 3px;
    }
    .total-row td {
      border-top: 2px solid #2b6cb0;
      border-bottom: 2px solid #2b6cb0;
      background: #edf2f7 !important;
      font-weight: bold;
      font-size: 14px;
      padding: 12px 10px;
    }
    .terms-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 14px;
      margin-top: 20px;
      font-size: 11.5px;
      color: #4a5568;
      page-break-inside: avoid;
    }
    .terms-title {
      font-weight: bold;
      color: #2d3748;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .signatures-table {
      width: 100%;
      margin-top: 40px;
      border-collapse: collapse;
      page-break-inside: avoid;
    }
    .sig-col {
      width: 48%;
      vertical-align: top;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 15px;
    }
    .sig-space {
      height: 45px;
    }
    .sig-line {
      border-top: 1px solid #718096;
      margin-top: 10px;
      padding-top: 5px;
      font-weight: bold;
      font-size: 12px;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td>
        <h1 class="header-title">Letter of Engagement</h1>
        <p class="header-subtitle">Professional Services Agreement &amp; Deliverables Schedule</p>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <div class="ref-badge">LOE REF: #${loe.loe_id}</div>
        <div style="font-size: 12px; color: #718096; margin-top: 6px;">Date: ${formatDate(loe.start_date)}</div>
      </td>
    </tr>
  </table>

  <!-- Client & Engagement Information -->
  <table class="details-grid">
    <tr>
      <td class="details-card">
        <div class="card-title">Client Details</div>
        <div class="card-row"><span class="card-label">Company:</span> <strong>${company?.name || 'N/A'}</strong></div>
        <div class="card-row"><span class="card-label">Client Type:</span> ${company?.client_type || 'Corporate'}</div>
        <div class="card-row"><span class="card-label">Reg Number:</span> ${company?.reg_number || 'N/A'}</div>
        <div class="card-row"><span class="card-label">TIN Number:</span> ${company?.tin_number || 'N/A'}</div>
        <div class="card-row"><span class="card-label">Email:</span> ${company?.email || 'N/A'}</div>
        <div class="card-row"><span class="card-label">Phone:</span> ${company?.phone_number || 'N/A'}</div>
      </td>
      <td style="width: 4%;"></td>
      <td class="details-card">
        <div class="card-title">Engagement Overview</div>
        <div class="card-row"><span class="card-label">Type:</span> <strong>${loe.type || 'Standard'}</strong></div>
        <div class="card-row"><span class="card-label">Start Date:</span> ${formatDate(loe.start_date)}</div>
        <div class="card-row"><span class="card-label">End Date:</span> ${loe.end_date ? formatDate(loe.end_date) : 'Ongoing / Project Completion'}</div>
        <div class="card-row"><span class="card-label">Status:</span> ${loe.status}</div>
        <div class="card-row"><span class="card-label">Currency:</span> USD ($)</div>
      </td>
    </tr>
  </table>

  <!-- Scope & Pricing Table -->
  <h3 style="font-size: 14px; text-transform: uppercase; color: #1a365d; margin: 20px 0 5px 0;">
    Scope of Services &amp; Fee Schedule
  </h3>

  <table class="services-table">
    <thead>
      <tr>
        <th style="width: 5%;">#</th>
        <th style="width: 55%;">Service &amp; Scope of Work</th>
        <th style="width: 20%;">Billing Terms</th>
        <th style="width: 20%; text-align: right;">Agreed Fee</th>
      </tr>
    </thead>
    <tbody>
      ${serviceList.map((srv, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <strong>${srv.name}</strong> 
            <span style="color: #718096; font-size: 11.5px;">(${srv.department}${srv.subCategory ? ' - ' + srv.subCategory : ''})</span>
            ${srv.scopes.length > 0 ? `
              <ul class="scope-list">
                ${srv.scopes.map(sc => `<li>${sc}</li>`).join('')}
              </ul>
            ` : '<div style="font-size: 11.5px; color: #718096; margin-top: 4px;">Standard engagement scope deliverables.</div>'}
          </td>
          <td>${srv.billingType}</td>           <td style="text-align: right; font-weight: 600;">$${formatCurrency(srv.amount)}</td>
        </tr>
      `).join('')}

      <!-- Total Row -->
      <tr class="total-row">
        <td colspan="3" style="text-align: right;">Total Agreed Professional Fees:</td>
        <td style="text-align: right; color: #1a365d;">$${formatCurrency(totalAmount)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Terms & Conditions -->
  <div class="terms-section">
    <div class="terms-title">Terms &amp; Conditions</div>
    <div>1. <strong>Payment Terms:</strong> Fees are payable in full according to the agreed billing terms upon invoice generation.</div>
    <div>2. <strong>Scope Revisions:</strong> Any additional requirements or out-of-scope services will be billed separately upon mutual written agreement.</div>
    <div>3. <strong>Confidentiality:</strong> Both parties agree to protect and keep all client data, financial statements, and technical records strictly confidential.</div>
  </div>

  <!-- Signatures -->
  <table class="signatures-table">
    <tr>
      <td class="sig-col">
        <div style="font-weight: bold; color: #2b6cb0;">For and on behalf of Service Provider:</div>
        <div class="sig-space"></div>
        <div class="sig-line">Authorized Signature</div>
        <div style="font-size: 11.5px; color: #718096;">Date: ${formatDate(loe.start_date)}</div>
      </td>
      <td style="width: 4%;"></td>
      <td class="sig-col">
        <div style="font-weight: bold; color: #2b6cb0;">Accepted and Agreed by Client:</div>
        <div class="sig-space"></div>
        <div class="sig-line">${company?.name || 'Client Representative'}</div>
        <div style="font-size: 11.5px; color: #718096;">Authorized Signatory / Date</div>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
};