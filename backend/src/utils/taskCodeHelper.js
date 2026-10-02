/**
 * Generates custom Task ID in the format: [company_acronym]/[scope_abbrev]/[number]
 * Example: "Animal Barkin Cats Pvt Ltd" + "Registration" + 1 => "abc/reg/001"
 */
function generateTaskCode(companyName, scopeText, number = 1) {
  // 1. Company Acronym (ignoring legal/corporate designations)
  let comp = (companyName || 'CMP')
    .toLowerCase()
    .replace(/\b(pvt|ltd|limited|private|llc|inc|corp|co|company|plc)\b/gi, '')
    .trim();

  const compWords = comp.split(/\s+/).filter(Boolean);
  let compCode = '';
  if (compWords.length >= 2) {
    compCode = compWords.map(w => w[0]).join('');
  } else if (compWords.length === 1) {
    compCode = compWords[0].slice(0, 3);
  } else {
    compCode = 'cmp';
  }
  compCode = compCode.toLowerCase().replace(/[^a-z0-9]/g, '') || 'cmp';

  // 2. Scope Abbreviation (first 3 alphanumeric letters of scope)
  let sc = (scopeText || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  const scWords = sc.split(/\s+/).filter(Boolean);
  let scopeCode = '';
  if (scWords.length > 0) {
    scopeCode = scWords[0].slice(0, 3);
  } else {
    scopeCode = 'tsk';
  }
  scopeCode = scopeCode.toLowerCase().replace(/[^a-z0-9]/g, '') || 'tsk';

  // 3. Sequential 3-digit padded number
  const numCode = String(number).padStart(3, '0');

  return `${compCode}/${scopeCode}/${numCode}`;
}

module.exports = { generateTaskCode };