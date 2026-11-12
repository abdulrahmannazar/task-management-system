const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');
const { enrichLoeWithCode } = require('../utils/taskCodeHelper');

/**
 * Validates contact/phone numbers cleanly (allows optional '+' prefix with country code,
 * 10-digit Sri Lankan local numbers like 077 123 4567, or 9-10 digit local numbers).
 * Rejects letters and absurd lengths like 13+ digit numbers without country code.
 */
function validatePhoneNumber(rawPhone, fieldLabel = 'Contact number') {
  if (!rawPhone || !String(rawPhone).trim()) {
    return { valid: true, value: null };
  }
  const trimmed = String(rawPhone).trim();

  if (!/^\+?[0-9\s\-()]+$/.test(trimmed)) {
    return {
      valid: false,
      error: `${fieldLabel} is invalid: only digits, spaces, hyphens, parentheses, and an optional leading '+' are allowed.`
    };
  }

  const compact = trimmed.replace(/[\s\-()]/g, '');
  const isValid = /^(\+[1-9]\d{9,14}|0\d{9}|[1-9]\d{8,9})$/.test(compact);
  if (!isValid) {
    return {
      valid: false,
      error: `${fieldLabel} is invalid: enter a valid 10-digit number (e.g. 077 123 4567) or international format with '+' (e.g. +94 77 123 4567).`
    };
  }

  return { valid: true, value: trimmed };
}

function validateEmailAddress(rawEmail, fieldLabel = 'Email address') {
  if (!rawEmail || !String(rawEmail).trim()) {
    return { valid: true, value: null };
  }
  const trimmed = String(rawEmail).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: `${fieldLabel} format is invalid.` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Checks for duplicate company Name, Registration Number, or TIN Number (case-insensitive)
 */
async function findDuplicateCompany({ name, reg_number, tin_number }, excludeId = null) {
  const idFilter = excludeId ? { company_id: { not: excludeId } } : {};

  if (name && name.trim()) {
    const dupName = await prisma.company.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        ...idFilter
      },
      select: { company_id: true, name: true }
    });
    if (dupName) {
      return `A company with the name "${dupName.name}" already exists.`;
    }
  }

  if (reg_number && reg_number.trim()) {
    const dupReg = await prisma.company.findFirst({
      where: {
        reg_number: { equals: reg_number.trim(), mode: 'insensitive' },
        ...idFilter
      },
      select: { company_id: true, name: true, reg_number: true }
    });
    if (dupReg) {
      return `Registration Number "${reg_number.trim()}" is already registered to "${dupReg.name}".`;
    }
  }

  if (tin_number && tin_number.trim()) {
    const dupTin = await prisma.company.findFirst({
      where: {
        tin_number: { equals: tin_number.trim(), mode: 'insensitive' },
        ...idFilter
      },
      select: { company_id: true, name: true, tin_number: true }
    });
    if (dupTin) {
      return `TIN Number "${tin_number.trim()}" is already registered to "${dupTin.name}".`;
    }
  }

  return null;
}

/**
 * Computes full LOE, Invoice, and Outstanding Dues history for a company
 */
function buildCompanyHistory(company) {
  const loesHistory = (company.loes || []).map((loe) => {
    const enriched = enrichLoeWithCode(loe);
    const totalValue = (loe.loe_items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      ...enriched,
      total_value: totalValue,
      invoices_count: loe.job?.invoices?.length || 0
    };
  });

  const invoicesHistory = [];
  const duesByCurrency = {};
  const billedByCurrency = {};
  const paidByCurrency = {};
  let unpaidCount = 0;

  loesHistory.forEach((loe) => {
    const currency = loe.currency || 'LKR';
    const jobInvoices = loe.job?.invoices || [];
    jobInvoices.forEach((inv) => {
      const amount = Number(inv.total_amount || 0);
      const isPaid = String(inv.status || '').toLowerCase() === 'paid';
      const dueDateObj = inv.due_date ? new Date(inv.due_date) : null;
      const isOverdue = !isPaid && dueDateObj && dueDateObj < new Date();

      billedByCurrency[currency] = (billedByCurrency[currency] || 0) + amount;
      if (isPaid) {
        paidByCurrency[currency] = (paidByCurrency[currency] || 0) + amount;
      } else {
        duesByCurrency[currency] = (duesByCurrency[currency] || 0) + amount;
        unpaidCount += 1;
      }

      invoicesHistory.push({
        invoice_id: inv.invoice_id,
        invoice_code: `INV-${String(inv.invoice_id).padStart(5, '0')}`,
        job_id: inv.job_id,
        loe_id: loe.loe_id,
        loe_code: loe.loe_code,
        currency,
        total_amount: amount,
        due_amount: isPaid ? 0 : amount,
        status: inv.status,
        is_paid: isPaid,
        is_overdue: isOverdue,
        issued_date: inv.issued_date,
        due_date: inv.due_date
      });
    });
  });

  invoicesHistory.sort((a, b) => b.invoice_id - a.invoice_id);

  return {
    ...company,
    loes: loesHistory,
    invoices: invoicesHistory,
    summary: {
      total_loes: loesHistory.length,
      approved_loes: loesHistory.filter((l) => l.status === 'Approved').length,
      pending_loes: loesHistory.filter((l) => ['Pending', 'Approval Pending'].includes(l.status)).length,
      discontinued_loes: loesHistory.filter((l) => l.status === 'Discontinued').length,
      total_invoices: invoicesHistory.length,
      unpaid_invoices_count: unpaidCount,
      billed_by_currency: billedByCurrency,
      paid_by_currency: paidByCurrency,
      dues_by_currency: duesByCurrency
    }
  };
}

// GET /api/companies
exports.getAll = asyncHandler(async (req, res) => {
  const companies = await prisma.company.findMany({
    include: {
      loes: {
        select: {
          loe_id: true,
          currency: true,
          status: true,
          job: {
            select: {
              invoices: {
                select: {
                  invoice_id: true,
                  total_amount: true,
                  status: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: { company_id: 'desc' }
  });

  const enriched = companies.map((comp) => {
    const duesByCurrency = {};
    let totalInvoices = 0;
    let unpaidInvoicesCount = 0;

    (comp.loes || []).forEach((l) => {
      const curr = l.currency || 'LKR';
      (l.job?.invoices || []).forEach((inv) => {
        totalInvoices += 1;
        if (String(inv.status || '').toLowerCase() !== 'paid') {
          duesByCurrency[curr] = (duesByCurrency[curr] || 0) + Number(inv.total_amount || 0);
          unpaidInvoicesCount += 1;
        }
      });
    });

    const { loes, ...companyFields } = comp;
    return {
      ...companyFields,
      summary: {
        total_loes: (loes || []).length,
        total_invoices: totalInvoices,
        unpaid_invoices_count: unpaidInvoicesCount,
        dues_by_currency: duesByCurrency
      }
    };
  });

  res.json(enriched);
});

// GET /api/companies/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const company = await prisma.company.findUnique({
    where: { company_id: id },
    include: {
      loes: {
        include: {
          creator: { select: { emp_id: true, name: true, email: true } },
          approver: { select: { emp_id: true, name: true, email: true } },
          loe_items: { include: { service: { include: { department: true } } } },
          job: {
            include: {
              invoices: {
                orderBy: { issued_date: 'desc' }
              }
            }
          }
        },
        orderBy: { loe_id: 'desc' }
      }
    }
  });

  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(buildCompanyHistory(company));
});

// POST /api/companies
exports.create = asyncHandler(async (req, res) => {
  const {
    name,
    client_type,
    reg_number,
    tin_number,
    email,
    phone_number,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone
  } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Company Name is required.' });
  }

  // Validate contact numbers and emails
  const phoneCheck = validatePhoneNumber(phone_number, 'Company phone number');
  if (!phoneCheck.valid) return res.status(400).json({ error: phoneCheck.error });

  const empPhoneCheck = validatePhoneNumber(primary_contact_phone, 'Primary / Employee contact phone number');
  if (!empPhoneCheck.valid) return res.status(400).json({ error: empPhoneCheck.error });

  const emailCheck = validateEmailAddress(email, 'Company email');
  if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });

  const empEmailCheck = validateEmailAddress(primary_contact_email, 'Primary / Employee contact email');
  if (!empEmailCheck.valid) return res.status(400).json({ error: empEmailCheck.error });

  // Prevent duplicates for Name, Registration Number, and TIN Number
  const duplicateError = await findDuplicateCompany({ name, reg_number, tin_number });
  if (duplicateError) {
    return res.status(409).json({ error: duplicateError });
  }

  const data = {
    name: String(name).trim(),
    client_type: client_type || 'Corporate',
    reg_number: reg_number && reg_number.trim() ? reg_number.trim() : null,
    tin_number: tin_number && tin_number.trim() ? tin_number.trim() : null,
    email: emailCheck.value,
    phone_number: phoneCheck.value,
    primary_contact_name: primary_contact_name && primary_contact_name.trim() ? primary_contact_name.trim() : null,
    primary_contact_email: empEmailCheck.value,
    primary_contact_phone: empPhoneCheck.value
  };

  try {
    const company = await prisma.company.create({ data });
    res.status(201).json(company);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate company details detected (Name, Registration No., or TIN must be unique).' });
    }
    throw err;
  }
});

// PUT /api/companies/:id
exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const {
    name,
    client_type,
    reg_number,
    tin_number,
    email,
    phone_number,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone
  } = req.body;

  if (name !== undefined && (!name || !String(name).trim())) {
    return res.status(400).json({ error: 'Company Name cannot be empty.' });
  }

  if (phone_number !== undefined) {
    const phoneCheck = validatePhoneNumber(phone_number, 'Company phone number');
    if (!phoneCheck.valid) return res.status(400).json({ error: phoneCheck.error });
  }

  if (primary_contact_phone !== undefined) {
    const empPhoneCheck = validatePhoneNumber(primary_contact_phone, 'Primary / Employee contact phone number');
    if (!empPhoneCheck.valid) return res.status(400).json({ error: empPhoneCheck.error });
  }

  if (email !== undefined) {
    const emailCheck = validateEmailAddress(email, 'Company email');
    if (!emailCheck.valid) return res.status(400).json({ error: emailCheck.error });
  }

  if (primary_contact_email !== undefined) {
    const empEmailCheck = validateEmailAddress(primary_contact_email, 'Primary / Employee contact email');
    if (!empEmailCheck.valid) return res.status(400).json({ error: empEmailCheck.error });
  }

  // Prevent duplicate Name, Reg No., TIN on update
  const duplicateError = await findDuplicateCompany({ name, reg_number, tin_number }, id);
  if (duplicateError) {
    return res.status(409).json({ error: duplicateError });
  }

  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (client_type !== undefined) data.client_type = client_type;
  if (reg_number !== undefined) data.reg_number = reg_number && reg_number.trim() ? reg_number.trim() : null;
  if (tin_number !== undefined) data.tin_number = tin_number && tin_number.trim() ? tin_number.trim() : null;
  if (email !== undefined) data.email = email && email.trim() ? email.trim() : null;
  if (phone_number !== undefined) data.phone_number = phone_number && phone_number.trim() ? phone_number.trim() : null;
  if (primary_contact_name !== undefined) data.primary_contact_name = primary_contact_name && primary_contact_name.trim() ? primary_contact_name.trim() : null;
  if (primary_contact_email !== undefined) data.primary_contact_email = primary_contact_email && primary_contact_email.trim() ? primary_contact_email.trim() : null;
  if (primary_contact_phone !== undefined) data.primary_contact_phone = primary_contact_phone && primary_contact_phone.trim() ? primary_contact_phone.trim() : null;

  try {
    const company = await prisma.company.update({
      where: { company_id: id },
      data
    });
    res.json(company);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate company details detected (Name, Registration No., or TIN must be unique).' });
    }
    throw err;
  }
});

// DELETE /api/companies/:id (Requires Password Verification)
const deleteCompany = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const password = req.body?.password || req.headers['x-confirm-password'];
  if (!password || !String(password).trim()) {
    return res.status(400).json({ error: 'Please enter your password to confirm deleting this company.' });
  }

  let empId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your_jwt_secret');
      if (decoded && decoded.emp_id) empId = decoded.emp_id;
    } catch {
      return res.status(401).json({ error: 'Session expired. Please log in again before deleting.' });
    }
  } else if (req.body?.emp_id) {
    empId = parseInt(req.body.emp_id);
  }

  if (!empId) {
    return res.status(401).json({ error: 'Authentication required to verify your password.' });
  }

  const employee = await prisma.employee.findUnique({ where: { emp_id: empId } });
  if (!employee) {
    return res.status(401).json({ error: 'Authenticated employee account not found.' });
  }

  const isPasswordValid = await bcrypt.compare(String(password), employee.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: 'Incorrect password. Company deletion cancelled.' });
  }

  const existing = await prisma.company.findUnique({
    where: { company_id: id },
    include: { _count: { select: { loes: true } } }
  });
  if (!existing) {
    return res.status(404).json({ error: 'Company not found' });
  }

  if (existing._count.loes > 0) {
    return res.status(400).json({
      error: `Cannot delete "${existing.name}" because it has ${existing._count.loes} linked Letter(s) of Engagement / history.`
    });
  }

  await prisma.company.delete({
    where: { company_id: id }
  });

  res.json({ message: `Company "${existing.name}" deleted successfully.` });
});

exports.remove = deleteCompany;
exports.delete = deleteCompany;
