/**
 * Generates custom Task ID: [COMPANY]/[SCOPE]/[NUMBER] in FULL CAPS (e.g. PMTI/SUB/013)
 */
function generateTaskCode(companyName, scopeText, number = 1) {
  let comp = (companyName || 'CMP')
    .replace(/\b(pvt|ltd|limited|private|llc|inc|corp|co|company|plc)\b/gi, '')
    .trim();

  const compWords = comp.split(/\s+/).filter(Boolean);
  let compCode = compWords.length >= 2 
    ? compWords.map(w => w[0]).join('') 
    : (compWords[0] || 'CMP').slice(0, 3);
  compCode = compCode.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'CMP';

  let sc = (scopeText || 'TASK').replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const scWords = sc.split(/\s+/).filter(Boolean);
  let scopeCode = scWords.length > 0 ? scWords[0].slice(0, 3) : 'TSK';
  scopeCode = scopeCode.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TSK';

  const numCode = String(number).padStart(3, '0');
  return `${compCode}/${scopeCode}/${numCode}`;
}

/**
 * Generates custom LOE ID: LOE - Department/Service/year(26)/number
 * Example: "LOE - ACC/TAX/26/001"
 */
function generateLoeCode(deptName, serviceName, dateOrYear, number = 1) {
  let dept = (deptName || 'GEN').trim().replace(/&/g, '');
  const deptWords = dept.split(/\s+/).filter(Boolean);
  let deptCode = deptWords.length >= 2 
    ? deptWords.slice(0, 3).map(w => w[0]).join('') 
    : (deptWords[0] || 'GEN').slice(0, 3);
  deptCode = deptCode.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';

  let srv = (serviceName || 'SRV').trim().replace(/&/g, '');
  const srvWords = srv.split(/\s+/).filter(Boolean);
  let srvCode = srvWords.length >= 2 
    ? srvWords.slice(0, 3).map(w => w[0]).join('') 
    : (srvWords[0] || 'SRV').slice(0, 3);
  srvCode = srvCode.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SRV';

  let yr = '26';
  if (dateOrYear) {
    const d = new Date(dateOrYear);
    if (!isNaN(d.getTime())) {
      yr = String(d.getFullYear()).slice(-2);
    }
  }

  const numCode = String(number || 1).padStart(3, '0');

  return `LOE - ${deptCode}/${srvCode}/${yr}/${numCode}`;
}

// Helper to extract fields directly from an LOE database record
function enrichLoeWithCode(loe) {
  if (!loe) return loe;
  const firstItem = loe.loe_items?.[0];
  const deptName = firstItem?.service?.department?.name || 'GEN';
  const serviceName = firstItem?.service?.name || 'SRV';
  const year = loe.start_date || new Date();
  
  return {
    ...loe,
    loe_code: generateLoeCode(deptName, serviceName, year, loe.loe_id)
  };
}

module.exports = { 
  generateTaskCode, 
  generateLoeCode,
  enrichLoeWithCode 
};