/**
 * Generates HTML for the Letter of Engagement (LOE) PDF including formatted scopes & selected currency
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

// Splits custom scopes, unicode bullets (•), and numbered items into clean individual bullet points
function extractBulletPoints(scopesArray) {
  const result = [];
  (scopesArray || []).forEach((rawScope) => {
    if (!rawScope) return;
    const parts = String(rawScope)
      .replace(/&bull;/gi, '•')
      .split(/\r?\n|[\u2022\u2023\u25E6\u2043\u2219•●▪♦]|\s+o\s+|\b(?=\d+\.\s+)/)
      .map((s) => s.replace(/^[-*•●▪♦\d.\s]+/, '').trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

    result.push(...parts);
  });
  return result.length > 0 ? result : ['Standard Service Scope'];
}

module.exports = function generateLoeTemplate({ loe, company }) {
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
  (loe.loe_items || []).forEach((item) => {
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
  const loeReference = loe.loe_code || `LOE #${loe.loe_id}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Letter of Engagement - ${loeReference}</title>
  <style>
    @page { size: A4; margin: 18mm 15mm; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2d3748; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e56a0; padding-bottom: 15px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: bold; color: #1e56a0; margin: 0; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .meta-box { text-align: right; font-size: 12px; }
    .section-title { font-size: 15px; font-weight: bold; color: #1e56a0; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin: 22px 0 12px; }
    .grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 15px; }
    .info-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; }
    .info-row { margin-bottom: 6px; font-size: 12px; }
    .info-label { font-weight: bold; color: #475569; display: inline-block; width: 125px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1e56a0; color: #fff; text-align: left; padding: 10px; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 12.5px; }
    .scope-list { margin: 8px 0 0 0; padding-left: 18px; color: #475569; line-height: 1.6; list-style-type: disc; }
    .scope-list li { margin-bottom: 6px; }
    .total-box { margin-top: 0; text-align: right; background: #ebf4ff; border-top: 2px solid #1e56a0; padding: 14px 18px; font-size: 14.5px; font-weight: bold; color: #0f172a; }
    .signature-grid { display: flex; justify-content: space-between; gap: 40px; margin-top: 50px; }
    .sig-block { flex: 1; border-top: 1px solid #94a3b8; padding-top: 8px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">LETTER OF ENGAGEMENT</h1>
      <div class="subtitle">Reference: <strong>${loeReference}</strong></div>
    </div>
    <div class="meta-box">
      <div><strong>Status:</strong> ${loe.status}</div>
      <div><strong>Date:</strong> ${formatDate(loe.start_date)}</div>
      <div><strong>Payment Currency:</strong> ${currencyCode} (${currencySymbol})</div>
    </div>
  </div>

  <div class="grid">
    <div class="info-card">
      <div style="font-weight: bold; margin-bottom: 8px; color: #0f172a;">Client Information</div>
      <div class="info-row"><span class="info-label">Company:</span> ${company?.name || 'N/A'}</div>
      <div class="info-row"><span class="info-label">Registration No:</span> ${company?.reg_no || 'N/A'}</div>
      <div class="info-row"><span class="info-label">Email:</span> ${company?.email || 'N/A'}</div>
      <div class="info-row"><span class="info-label">Phone:</span> ${company?.phone || 'N/A'}</div>
    </div>
    <div class="info-card">
      <div style="font-weight: bold; margin-bottom: 8px; color: #0f172a;">Engagement Terms</div>
      <div class="info-row"><span class="info-label">Engagement Type:</span> ${loe.type || 'Adhoc'}</div>
      <div class="info-row"><span class="info-label">Billing Cycle:</span> ${loe.billing_frequency || 'One-Time'}</div>
      <div class="info-row"><span class="info-label">Billing Currency:</span> ${currencyCode} (${currencySymbol})</div>
      <div class="info-row"><span class="info-label">Effective Date:</span> ${formatDate(loe.start_date)}</div>
    </div>
  </div>

  <div class="section-title">Schedule of Services, Scope &amp; Professional Fees</div>
  <table>
    <thead>
      <tr>
        <th style="width: 6%;">#</th>
        <th style="width: 56%;">Service &amp; Scope of Work</th>
        <th style="width: 16%;">Billing Type</th>
        <th style="width: 22%; text-align: right;">Agreed Fee (${currencyCode})</th>
      </tr>
    </thead>
    <tbody>
      ${serviceList.map((srv, idx) => {
        const cleanBullets = extractBulletPoints(srv.scopes);
        const deptInfo = srv.subCategory
          ? `${srv.department} - ${srv.subCategory}`
          : srv.department;

        return `
          <tr>
            <td style="font-weight: bold; color: #334155;">${idx + 1}</td>
            <td>
              <div>
                <strong style="font-size: 13.5px; color: #0f172a;">${srv.name}</strong>
                <span style="color: #64748b; font-size: 12px;"> (${deptInfo})</span>
              </div>
              <ul class="scope-list">
                ${cleanBullets.map(pt => `<li>${pt}</li>`).join('')}
              </ul>
            </td>
            <td style="color: #334155;">${srv.billingType}</td>
            <td style="text-align: right; font-weight: bold; font-size: 13px; color: #0f172a;">
              ${formatCurrency(srv.amount)}
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="total-box">
    Total Agreed Professional Fee (${currencyCode}): ${formatCurrency(totalAmount)}
  </div>

  <div class="signature-grid">
    <div class="sig-block">
      <strong>For and on behalf of Firm</strong><br/>
      Authorized Signatory &amp; Date
    </div>
    <div class="sig-block">
      <strong>Accepted by ${company?.name || 'Client'}</strong><br/>
      Authorized Signatory &amp; Date
    </div>
  </div>
</body>
</html>
  `;
};