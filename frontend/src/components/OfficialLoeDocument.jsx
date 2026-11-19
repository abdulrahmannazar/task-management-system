import React from 'react';

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
      if (/^[oO][\s\t]+/.test(part)) {
        lines.push({
          type: 'sub',
          text: part.replace(/^[oO][\s\t]+/, '').trim()
        });
      } else if (/^\d+\.\d+\s+/.test(part)) {
        lines.push({
          type: 'subheading',
          text: part
        });
      } else {
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

/**
 * Isolated Clean Printing Helper
 * Opens the print preview dialog rendering ONLY the LOE document sheet
 * with exact A4 print styles matching the official PDF template.
 */
export function printOfficialLoeDocument(elementId = 'official-loe-document-sheet') {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    window.print();
    return;
  }

  // Remove existing print iframe if any
  const existingIframe = document.getElementById('loe-print-isolated-iframe');
  if (existingIframe) {
    try { existingIframe.remove(); } catch (_) {}
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'loe-print-isolated-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Letter of Engagement</title>
  <style>
    @page {
      size: A4 portrait;
      margin-top: 18mm;
      margin-bottom: 20mm;
      margin-left: 18mm;
      margin-right: 18mm;
    }
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      text-align: left;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .loe-doc-watermark {
      position: fixed;
      top: 38%;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 72pt;
      font-family: 'Times New Roman', Times, serif;
      font-weight: bold;
      color: rgba(225, 29, 72, 0.12);
      transform: rotate(-45deg);
      pointer-events: none;
      z-index: 1000;
      letter-spacing: 6px;
      text-transform: uppercase;
      user-select: none;
      white-space: nowrap;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
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
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
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
      line-height: 1.45;
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
    .rich-scope-container {
      margin: 4px 0 10px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #000;
    }
    .rich-scope-container p {
      margin: 0 0 6px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      text-align: justify;
    }
    .rich-scope-container h2 {
      font-size: 12pt;
      font-weight: bold;
      margin: 8px 0 4px 0;
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      break-after: avoid;
      page-break-after: avoid;
    }
    .rich-scope-container h3 {
      font-size: 11pt;
      font-weight: bold;
      margin: 6px 0 3px 0;
      font-family: 'Times New Roman', Times, serif;
      color: #000;
      break-after: avoid;
      page-break-after: avoid;
    }
    .rich-scope-container ul {
      margin: 4px 0 8px 0;
      padding-left: 24px;
      list-style-type: disc;
    }
    .rich-scope-container ol {
      margin: 4px 0 8px 0;
      padding-left: 24px;
      list-style-type: decimal;
    }
    .rich-scope-container li {
      margin-bottom: 4px;
      padding-left: 4px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.4;
      text-align: justify;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .rich-scope-container pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      background: #f1f5f9;
      padding: 6px 8px;
      border-radius: 4px;
      white-space: pre-wrap;
      margin: 6px 0;
    }
    .rich-scope-container a {
      color: #0284c7;
      text-decoration: underline;
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
    .fees-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000000;
      margin: 10px 0 12px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .fees-table th,
    .fees-table td {
      border: 1px solid #000000;
      padding: 6px 10px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      vertical-align: middle;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .fees-table th {
      background-color: #f8fafc !important;
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
      background-color: #fafafa !important;
    }
    .fee-note {
      font-style: italic;
      margin: 10px 0 14px 0;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.45;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .signature-section {
      margin-top: 20px;
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .dotted-line {
      margin-top: 32px;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
    .doc-footer {
      margin-top: 35px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 8pt;
      color: #475569;
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  ${sourceEl.innerHTML}
</body>
</html>`);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error('Print error:', e);
      window.print();
    }
    setTimeout(() => {
      try {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch (_) {}
    }, 2000);
  }, 300);
}

/**
 * Official LOE Document Component
 * Exact clone of the official PDF generated by loeTemplate.js
 */
export default function OfficialLoeDocument({
  loe = {},
  company = null,
  services = [],
  departments = [],
  isDraft = true,
  className = '',
  id = 'official-loe-document-sheet'
}) {
  const currencyCode = loe?.currency || 'LKR';

  const formatFeeAmount = (val) => {
    const num = Number(val || 0);
    const hasDecimals = num % 1 !== 0;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${currencyCode} ${formatted}`;
  };

  // Group LOE items / services
  const serviceList = [];
  if (Array.isArray(loe?.loe_services) && loe.loe_services.length > 0) {
    // Structure from LoeManager formData
    loe.loe_services.forEach((srvBlock, idx) => {
      const matched = services.find(s => String(s.service_id) === String(srvBlock.service_id));
      const srvName = srvBlock.is_custom 
        ? (srvBlock.custom_service_name || 'Custom Advisory Service') 
        : (matched?.name || 'Professional Service');
      const subCategory = matched?.sub_category || '';
      const billingType = matched?.billing_type || srvBlock.billing_type || loe?.billing_frequency || loe?.type || 'Fixed';
      const validScopes = (srvBlock.scopes || []).filter(s => String(s || '').replace(/<[^>]*>/g, '').trim().length > 0);

      serviceList.push({
        serviceId: srvBlock.service_id || idx,
        name: srvName,
        subCategory,
        billingType,
        billingRoutine: billingType,
        amount: Number(srvBlock.amount || 0),
        scopes: validScopes.length > 0 ? validScopes : ['Standard professional services as agreed.']
      });
    });
  } else if (Array.isArray(loe?.loe_items)) {
    // Structure from backend LoeDetails
    const serviceMap = new Map();
    loe.loe_items.forEach((item) => {
      const sId = item.service_id;
      if (!serviceMap.has(sId)) {
        const billingType = item.service?.billing_type || loe?.billing_frequency || loe?.type || 'Monthly';
        serviceMap.set(sId, {
          serviceId: sId,
          name: item.service?.name || `Service #${sId}`,
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
    serviceList.push(...Array.from(serviceMap.values()));
  }

  const totalAmount = serviceList.reduce((acc, srv) => acc + srv.amount, 0);

  const loeReference = loe?.loe_code
    ? loe.loe_code
    : loe?.loe_id
    ? `#${String(loe.loe_id).padStart(7, '0')}`
    : 'LOE - DRAFT';

  const clientName = company?.name || company?.company_name || loe?.company?.name || 'The Client';

  // Dynamic section numbers matching loeTemplate.js
  const infoSectionNum = serviceList.length + 1;
  const feesSectionNum = serviceList.length + 2;
  const paymentSectionNum = serviceList.length + 3;
  const limitationsSectionNum = serviceList.length + 4;
  const basisSectionNum = serviceList.length + 5;

  return (
    <div className={`loe-official-doc-root ${className}`}>
      <style>{`
        .loe-doc-sheet {
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
          border-radius: 4px;
          padding: 48px 56px;
          max-width: 850px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          color: #000000;
          line-height: 1.45;
          text-align: left;
        }

        .loe-doc-sheet * {
          box-sizing: border-box;
        }

        .loe-doc-watermark {
          position: absolute;
          top: 45%;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 72pt;
          font-family: 'Times New Roman', Times, serif;
          font-weight: bold;
          color: rgba(225, 29, 72, 0.12);
          transform: rotate(-45deg);
          pointer-events: none;
          z-index: 10;
          letter-spacing: 6px;
          text-transform: uppercase;
          user-select: none;
          white-space: nowrap;
        }

        .top-banner-container {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 4px;
        }

        .brand-banner-img {
          width: 380px;
          max-width: 90%;
          height: auto;
          display: inline-block;
        }

        .date-ref-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
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
        }

        .subject-line {
          font-weight: bold;
          text-decoration: underline;
          margin-bottom: 14px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

        .loe-doc-sheet p {
          margin: 0 0 10px 0;
          text-align: justify;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.45;
        }

        .underlined-heading {
          font-weight: bold;
          text-decoration: underline;
          margin: 14px 0 8px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

        .section-heading {
          font-weight: bold;
          margin: 16px 0 6px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

        .sub-section-heading {
          font-weight: bold;
          margin: 10px 0 4px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

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
        }

        .scope-sub-list {
          list-style-type: none;
          margin: 3px 0 6px 20px;
          padding: 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

        .scope-sub-list li {
          margin-bottom: 4px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

        .scope-sub-list li::before {
          content: "o  ";
          font-weight: bold;
        }

        .rich-scope-container {
          margin: 4px 0 10px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.45;
          color: #000;
        }

        .rich-scope-container p {
          margin: 0 0 6px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.45;
          text-align: justify;
        }

        .rich-scope-container h2 {
          font-size: 12pt;
          font-weight: bold;
          margin: 8px 0 4px 0;
          font-family: 'Times New Roman', Times, serif;
          color: #000;
        }

        .rich-scope-container h3 {
          font-size: 11pt;
          font-weight: bold;
          margin: 6px 0 3px 0;
          font-family: 'Times New Roman', Times, serif;
          color: #000;
        }

        .rich-scope-container ul {
          margin: 4px 0 8px 0;
          padding-left: 24px;
          list-style-type: disc;
        }

        .rich-scope-container ol {
          margin: 4px 0 8px 0;
          padding-left: 24px;
          list-style-type: decimal;
        }

        .rich-scope-container li {
          margin-bottom: 4px;
          padding-left: 4px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.4;
          text-align: justify;
        }

        .rich-scope-container pre {
          font-family: 'Courier New', Courier, monospace;
          font-size: 10pt;
          background: #f1f5f9;
          padding: 6px 8px;
          border-radius: 4px;
          white-space: pre-wrap;
          margin: 6px 0;
        }

        .rich-scope-container a {
          color: #0284c7;
          text-decoration: underline;
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
        }

        .fees-table {
          width: 100%;
          border-collapse: collapse;
          border: 1.5px solid #000000;
          margin: 10px 0 12px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
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

        .fee-note {
          font-style: italic;
          margin: 10px 0 14px 0;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.45;
        }

        .signature-section {
          margin-top: 20px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
        }

        .dotted-line {
          margin-top: 32px;
          margin-bottom: 4px;
          letter-spacing: 1px;
        }

        .doc-footer {
          margin-top: 40px;
          padding-top: 6px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 8pt;
          color: #475569;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin-top: 18mm;
            margin-bottom: 20mm;
            margin-left: 18mm;
            margin-right: 18mm;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          nav, header, footer, aside, .no-print, button, input {
            display: none !important;
          }

          /* Unwind fixed modal wrappers so content paginates across multi-page sheets */
          .draft-modal-overlay,
          .draft-modal-container,
          .draft-document-scroll-wrap {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            backdrop-filter: none !important;
          }

          .loe-official-doc-root {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          .loe-doc-sheet {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            background: transparent !important;
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 11pt !important;
            line-height: 1.45 !important;
            color: #000000 !important;
          }

          .loe-doc-watermark {
            position: fixed !important;
            top: 38% !important;
            left: 0 !important;
            right: 0 !important;
            text-align: center !important;
            font-size: 72pt !important;
            font-family: 'Times New Roman', Times, serif !important;
            font-weight: bold !important;
            color: rgba(225, 29, 72, 0.12) !important;
            transform: rotate(-45deg) !important;
            pointer-events: none !important;
            z-index: 1000 !important;
            letter-spacing: 6px !important;
            text-transform: uppercase !important;
            user-select: none !important;
            white-space: nowrap !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .top-banner-container,
          .date-ref-row,
          .recipient-block,
          .subject-line,
          .signature-section,
          .fees-table,
          .fee-note,
          .doc-footer,
          p {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .underlined-heading,
          .section-heading,
          .sub-section-heading {
            break-after: avoid !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .fees-table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1.5px solid #000000 !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .fees-table th,
          .fees-table td {
            border: 1px solid #000000 !important;
            padding: 6px 10px !important;
            font-family: 'Times New Roman', Times, serif !important;
            font-size: 11pt !important;
            vertical-align: middle !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .fees-table th {
            background-color: #f8fafc !important;
            font-weight: bold !important;
          }

          .fees-table tr.total-row td {
            font-weight: bold !important;
            background-color: #fafafa !important;
          }

          .fees-table tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .scope-ordered-list li,
          .scope-sub-list li,
          .rich-scope-container li,
          .exclusion-list li {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="loe-doc-sheet" id={id}>
        {/* Semi-Transparent Diagonal DRAFT Watermark */}
        {isDraft && <div className="loe-doc-watermark">DRAFT</div>}

        {/* Top Letterhead Banner */}
        <div className="top-banner-container">
          <img
            src="/frontier_logo_banner.png"
            className="brand-banner-img"
            alt="Frontier Advisory"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div style={{ display: 'none', textAlign: 'center', marginBottom: '16px', borderBottom: '2px solid #0f172a', paddingBottom: '12px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', letterSpacing: '1px', textTransform: 'uppercase' }}>
              FRONTIER ADVISORY (PRIVATE) LIMITED
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              Corporate Advisory • Tax &amp; Regulatory Services • Management Consulting
            </div>
          </div>
        </div>

        {/* Date and Reference Code */}
        <div className="date-ref-row">
          <div>{formatOrdinalDate(loe?.start_date)},</div>
          <div className="ref-code">{loeReference}</div>
        </div>

        {/* Recipient */}
        <div className="recipient-block">
          The Directors,<br />
          {clientName},
        </div>

        {/* Subject Line */}
        <div className="subject-line">
          Subject: Engagement Letter for the Provision of Professional Services
        </div>

        {/* Opening Paragraph */}
        <p>
          We refer to your request with regard to the aforementioned subject and would like to thank you for providing
          Frontier Advisory (Private) Limited the opportunity to serve you.
        </p>

        {/* About Us */}
        <div className="underlined-heading">About Us</div>
        <p>
          Frontier Advisory (Private) Limited (“We”) is a leading financial advisory company which has been in
          operation for the past 10 years. We have provided various types of financial services to clients both locally
          and internationally. Our Local &amp; International clients include HNB, Transco Cargo, Transco Travels,
          Melbn, Roar, Tesco, Nokia, Barath Electronics, PBL Transport, Sunray, Next BT, Docomo Intertouch,
          Parley, Pernod Ricard, China National Cable Corporation, UPL Lanka, Guild Gem, Probuild Engineering,
          Fire-X Project, Ceylon Artisans, Windsor Castle, CR Exports, C1 Hotel and Hostel, MSN Labs, Bungy
          Lanka, Wendroff &amp; Associates, A. O. Smith Water Products, Canadian Chamber of Commerce etc.
        </p>

        {/* Scope of Work Section */}
        <div className="underlined-heading">
          Our scope of work will be carried out in the following phases:
        </div>

        {serviceList.length === 0 ? (
          <p style={{ fontStyle: 'italic', color: '#64748b' }}>
            No service deliverables specified yet.
          </p>
        ) : (
          serviceList.map((srv, idx) => {
            const hasHtml = (srv.scopes || []).some((sc) => /<[a-z][\s\S]*>/i.test(sc));

            let contentElement = null;
            if (hasHtml) {
              contentElement = (
                <div className="rich-scope-container">
                  {(srv.scopes || []).map((sc, sIdx) => {
                    if (/<[a-z][\s\S]*>/i.test(sc)) {
                      return (
                        <div
                          key={sIdx}
                          dangerouslySetInnerHTML={{ __html: sc }}
                        />
                      );
                    }
                    return (
                      <p
                        key={sIdx}
                        dangerouslySetInnerHTML={{ __html: String(sc).replace(/\n/g, '<br/>') }}
                      />
                    );
                  })}
                </div>
              );
            } else {
              const parsedItems = parseStructuredScopes(srv.scopes);
              contentElement = (
                <ol className="scope-ordered-list">
                  {parsedItems.map((item, pIdx) => {
                    if (item.type === 'subheading') {
                      return (
                        <div key={pIdx} className="sub-section-heading">
                          {item.text}
                        </div>
                      );
                    }
                    if (item.type === 'sub') {
                      return (
                        <ul key={pIdx} className="scope-sub-list">
                          <li>{item.text}</li>
                        </ul>
                      );
                    }
                    return <li key={pIdx}>{item.text}</li>;
                  })}
                </ol>
              );
            }

            return (
              <div key={idx}>
                <div className="section-heading">
                  {idx + 1}. {srv.name}{srv.subCategory ? ` – ${srv.subCategory}` : ''}
                </div>
                <p style={{ marginBottom: '6px' }}>The scope of work will include the following:</p>
                {contentElement}
              </div>
            );
          })
        )}

        {/* Information and Assistance from the Client */}
        <div className="section-heading">
          {infoSectionNum}. Information and Assistance from the Client
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

        {/* Professional Fees Table */}
        <div className="section-heading">
          {feesSectionNum}. Professional Fees
        </div>
        <p style={{ marginBottom: '8px' }}>
          Our professional fees for the above services will be charged as follows:
        </p>

        <table className="fees-table">
          <thead>
            <tr>
              <th style={{ width: '52%' }}>Service</th>
              <th style={{ width: '24%', textAlign: 'center' }}>Billing Routine</th>
              <th style={{ width: '24%', textAlign: 'right' }}>Professional Fee</th>
            </tr>
          </thead>
          <tbody>
            {serviceList.map((srv, sIdx) => (
              <tr key={sIdx}>
                <td>{srv.name}{srv.subCategory ? ` (${srv.subCategory})` : ''}</td>
                <td className="center">{srv.billingRoutine}</td>
                <td className="right">{formatFeeAmount(srv.amount)}</td>
              </tr>
            ))}
            {serviceList.length > 1 && (
              <tr className="total-row">
                <td colSpan={2}><strong>Total Agreed Professional Fee</strong></td>
                <td className="right"><strong>{formatFeeAmount(totalAmount)}</strong></td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Out-of-pocket Expenses Note */}
        <p className="fee-note">
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

        {/* Payment Terms */}
        <div className="section-heading">
          {paymentSectionNum}. Payment Terms
        </div>
        <p>
          The professional fees for the engagement will be invoiced upon commencement of the engagement ({loe?.type || 'Adhoc'} – {loe?.billing_frequency || 'One-Time'} billing).
        </p>
        <p>
          All invoices are payable within 15 days from the date of invoice.
        </p>

        {/* Scope Limitations */}
        <div className="section-heading">
          {limitationsSectionNum}. Scope Limitations
        </div>
        <p style={{ marginBottom: '6px' }}>
          Our engagement is limited to the services specifically described in this Letter of Engagement.
        </p>
        <p style={{ marginBottom: '6px' }}>
          The following services are excluded unless separately agreed in writing:
        </p>
        <ul className="exclusion-list">
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

        {/* Basis of Our Engagement */}
        <div className="section-heading">
          {basisSectionNum}. Basis of Our Engagement
        </div>
        <p>
          Our services will be performed based on the information and records made available to us by the
          Company and information accessible through the RAMIS system and the IRD.
        </p>
        <p>
          We will not be responsible for delays arising from the Company&apos;s failure to provide information,
          supporting documents or authorisations, or delays in processing by the IRD.
        </p>
        <p>
          Our engagement does not constitute an audit or assurance engagement, and we do not provide assurance
          regarding the completeness or accuracy of information maintained by the IRD or provided by the
          Company.
        </p>

        {/* Sign-Off & Acceptance Block */}
        <div className="signature-section">
          <p>Please do not hesitate to contact us for any further clarifications.</p>
          <p style={{ marginTop: '14px' }}>Yours Sincerely,</p>

          <div className="dotted-line">……………………………</div>
          <div style={{ fontWeight: 'bold' }}>Frontier Advisory (Private) Limited</div>

          <p style={{ marginTop: '28px' }}>We hereby agree to this Letter of Engagement</p>

          <div className="dotted-line">
            {loe?.client_signatory_name ? 'Digitally Signed & Accepted' : '……………………………'}
          </div>
          <div>Authorized Signatory on behalf of: <strong>{clientName}</strong></div>
          {loe?.client_signatory_name && (
            <div style={{ marginTop: '2px' }}>Name: <strong>{loe.client_signatory_name}</strong></div>
          )}
          {loe?.client_signatory_title && (
            <div style={{ marginTop: '2px' }}>Designation: <strong>{loe.client_signatory_title}</strong></div>
          )}
          <div style={{ marginTop: '4px' }}>
            Date: {loe?.client_accepted_at ? formatOrdinalDate(loe.client_accepted_at) : '……………………………'}
          </div>
        </div>

        {/* Document Footer */}
        <div className="doc-footer">
          <div>15/1D, Joseph&apos;s Lane, Colombo 04</div>
          <div>+94 115 925 233 / +94 112 500 117</div>
          <div>www.frontierlk.com | info@frontierlk.com</div>
        </div>
      </div>
    </div>
  );
}
