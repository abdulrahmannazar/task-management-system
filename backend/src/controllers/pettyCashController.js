const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');
const { generateTaskCode } = require('../utils/taskCodeHelper');

let tableSchemaInitialized = false;

/**
 * Ensures two-tier approval audit columns exist on petty_cash_requests
 */
async function ensureTableExists() {
  if (tableSchemaInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE petty_cash_requests
        ADD COLUMN IF NOT EXISTS manager_approved_by INTEGER REFERENCES employees(emp_id),
        ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS finance_approved_by INTEGER REFERENCES employees(emp_id),
        ADD COLUMN IF NOT EXISTS finance_approved_at TIMESTAMP;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE petty_cash_requests
        ALTER COLUMN status SET DEFAULT 'Pending Manager Approval';
    `);
    tableSchemaInitialized = true;
  } catch (err) {
    console.error('[PettyCash] ensureTableExists check warning:', err.message);
  }
}

/**
 * Shared Prisma include tree for PettyCash queries
 */
const PETTY_CASH_INCLUDE = {
  employee: {
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true,
      department_id: true,
      department: true
    }
  },
  task: {
    include: {
      service: {
        include: { department: true }
      },
      job: {
        include: {
          loe: {
            include: { company: true }
          }
        }
      },
      assignees: {
        select: {
          emp_id: true,
          name: true,
          email: true,
          department_id: true
        }
      }
    }
  },
  approver: {
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true
    }
  },
  manager_approver: {
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true
    }
  },
  finance_approver: {
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true
    }
  }
};

/**
 * Extracts authenticated user context from JWT header or query/body fallback
 */
const getUserFromReq = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      if (decoded && decoded.emp_id) {
        return {
          emp_id: decoded.emp_id,
          role: (decoded.role || 'EMPLOYEE').toUpperCase(),
          department_id: decoded.department_id || null
        };
      }
    } catch (e) {
      // Token expired or invalid, fall through to param fallback
    }
  }

  return {
    emp_id: req.query.emp_id ? parseInt(req.query.emp_id) : (req.body.emp_id ? parseInt(req.body.emp_id) : null),
    role: (req.query.role || req.body.role || 'EMPLOYEE').toUpperCase(),
    department_id: req.query.department_id ? parseInt(req.query.department_id) : (req.body.department_id ? parseInt(req.body.department_id) : null)
  };
};

/**
 * Checks whether user belongs to Finance/Accounting department
 */
async function isUserInFinanceDept(user) {
  if (!user) return false;
  if (user.role === 'FINANCE') return true;
  if (!user.department_id) return false;

  try {
    const dept = await prisma.department.findUnique({
      where: { department_id: parseInt(user.department_id) },
      select: { name: true }
    });
    const deptName = String(dept?.name || '').toLowerCase();
    return deptName.includes('finance') || deptName.includes('accounting');
  } catch {
    return false;
  }
}

/**
 * Helper to compute task code safely in uppercase format
 */
const enrichTaskCode = (task) => {
  if (!task) return null;
  if (task.task_code) return String(task.task_code).toUpperCase();
  const companyName = task.job?.loe?.company?.name || 'CMP';
  const scopeOrService = task.scope || task.service?.name;
  return generateTaskCode(companyName, scopeOrService, task.task_id).toUpperCase();
};

const enrichPettyCashRecord = (pc) => {
  if (pc && pc.task) {
    pc.task.task_code = enrichTaskCode(pc.task);
  }
  return pc;
};

// GET /api/petty-cash
exports.getAll = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const role = user.role;
  const deptId = user.department_id;
  const empId = user.emp_id;
  const isFinance = await isUserInFinanceDept(user);

  const query = {
    include: PETTY_CASH_INCLUDE,
    orderBy: { petty_cash_id: 'desc' }
  };

  if (role === 'ADMIN' || isFinance) {
    // Admin and Finance Department receive all records for cross-department finance review
  } else if (role === 'MANAGER') {
    const conditions = [];
    if (deptId) {
      conditions.push({ task: { service: { department_id: deptId } } });
      conditions.push({ employee: { department_id: deptId } });
    }
    if (empId) {
      conditions.push({ emp_id: empId });
    }
    query.where = conditions.length > 0 ? { OR: conditions } : {};
  } else {
    if (!empId) {
      return res.status(401).json({ error: 'User identification required' });
    }
    query.where = { emp_id: empId };
  }

  const requests = await prisma.pettyCash.findMany(query);
  res.json(requests.map(enrichPettyCashRecord));
});

// GET /api/petty-cash/allocated-tasks
exports.getAllocatedTasks = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const role = user.role;
  const deptId = user.department_id;
  const empId = user.emp_id;

  const query = {
    include: {
      service: { include: { department: true } },
      job: {
        include: {
          loe: {
            include: { company: true }
          }
        }
      },
      assignees: {
        select: {
          emp_id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { task_id: 'desc' }
  };

  if (role === 'ADMIN') {
    query.where = { status: { not: 'Completed' } };
  } else if (role === 'MANAGER') {
    const conditions = [];
    if (deptId) conditions.push({ service: { department_id: deptId } });
    if (empId) conditions.push({ assignees: { some: { emp_id: empId } } });
    query.where = {
      AND: [
        { status: { not: 'Completed' } },
        conditions.length > 0 ? { OR: conditions } : {}
      ]
    };
  } else {
    if (!empId) {
      return res.status(401).json({ error: 'User identification required' });
    }
    query.where = {
      status: { not: 'Completed' },
      assignees: { some: { emp_id: empId } }
    };
  }

  const tasks = await prisma.task.findMany(query);

  const formatted = tasks.map((t) => ({
    task_id: t.task_id,
    task_code: enrichTaskCode(t),
    service_id: t.service_id,
    service_name: t.service?.name || 'General Service',
    company_id: t.job?.loe?.company?.company_id || null,
    company_name: t.job?.loe?.company?.name || 'Internal / N/A',
    scope: t.scope || t.service?.name || 'Task Deliverable',
    status: t.status,
    assignees: t.assignees
  }));

  res.json(formatted);
});

// GET /api/petty-cash/:id
exports.getById = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const record = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id },
    include: PETTY_CASH_INCLUDE
  });

  if (!record) return res.status(404).json({ error: 'Petty Cash record not found' });
  res.json(enrichPettyCashRecord(record));
});

// POST /api/petty-cash
exports.create = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const { task_id, amount, category, purpose, date_required } = req.body;
  const empId = user.role === 'ADMIN' && req.body.emp_id ? parseInt(req.body.emp_id) : user.emp_id;

  if (!empId) {
    return res.status(401).json({ error: 'Unauthorized. Employee identity required.' });
  }

  // 1. Validation checks
  const parsedTaskId = parseInt(task_id);
  if (isNaN(parsedTaskId)) {
    return res.status(400).json({ error: 'Valid allocated Task ID is required.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number greater than 0.' });
  }

  if (!category || !category.trim()) {
    return res.status(400).json({ error: 'Expense category is required.' });
  }

  if (!purpose || !purpose.trim()) {
    return res.status(400).json({ error: 'Purpose / reason for expenditure is required.' });
  }

  if (!date_required) {
    return res.status(400).json({ error: 'Date required is mandatory.' });
  }

  const parsedDate = new Date(date_required);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format for Date Required.' });
  }

  // 2. Task Allocation Verification Gate
  const task = await prisma.task.findUnique({
    where: { task_id: parsedTaskId },
    include: {
      assignees: true,
      service: { include: { department: true } },
      job: { include: { loe: { include: { company: true } } } }
    }
  });

  if (!task) {
    return res.status(404).json({ error: 'Selected task was not found.' });
  }

  const isAssignee = task.assignees.some((a) => a.emp_id === empId);
  if (!isAssignee && user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'You must be actively allocated to this task to request petty cash for it.'
    });
  }

  // 3. Create Petty Cash record with Initial Status "Pending Manager Approval"
  const newRequest = await prisma.pettyCash.create({
    data: {
      emp_id: empId,
      task_id: parsedTaskId,
      amount: parsedAmount,
      category: category.trim(),
      purpose: purpose.trim(),
      date_required: parsedDate,
      status: 'Pending Manager Approval'
    },
    include: PETTY_CASH_INCLUDE
  });

  enrichPettyCashRecord(newRequest);

  // 4. In-App Notification to Department Manager & Admins
  try {
    const managers = await prisma.employee.findMany({
      where: {
        OR: [
          { role: 'ADMIN' },
          { role: 'MANAGER', department_id: task.service?.department_id }
        ]
      },
      select: { emp_id: true }
    });

    const notifData = managers.map((m) => ({
      emp_id: m.emp_id,
      title: 'New Petty Cash Request',
      message: `${newRequest.employee?.name || 'Employee'} submitted a petty cash request of Rs. ${parsedAmount.toFixed(2)} for Task ${newRequest.task?.task_code || '#' + parsedTaskId} (${category.trim()}). Awaiting Manager Approval.`
    }));

    if (notifData.length > 0) {
      await prisma.notification.createMany({ data: notifData });
    }
  } catch (notifErr) {
    console.error('Failed to create in-app notification for petty cash:', notifErr);
  }

  res.status(201).json(newRequest);
});

// PUT /api/petty-cash/:id/approve
// Step 1 (Manager Step): Only allowed if requester is MANAGER or ADMIN.
// Transitions status from 'Pending Manager Approval' (or legacy 'Pending') to 'Pending Finance Approval'.
exports.approve = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return res.status(403).json({ error: 'Access forbidden. Only Managers and Admins can complete manager approval.' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id },
    include: { task: true, employee: true }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  if (!['Pending Manager Approval', 'Pending'].includes(existing.status)) {
    return res.status(400).json({
      error: `Cannot perform manager approval: claim is currently in "${existing.status}" status.`
    });
  }

  const now = new Date();
  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Pending Finance Approval',
      manager_approved_by: user.emp_id || null,
      manager_approved_at: now,
      approved_by: user.emp_id || null,
      approved_at: now
    },
    include: PETTY_CASH_INCLUDE
  });

  enrichPettyCashRecord(updated);

  // Notify Finance Department, Admins & Employee
  try {
    await prisma.notification.create({
      data: {
        emp_id: updated.emp_id,
        title: 'Petty Cash Manager Approved',
        message: `Your petty cash request of Rs. ${Number(updated.amount).toFixed(2)} has been verified by your manager and sent to Finance for disbursement.`
      }
    });

    const financeDepts = await prisma.department.findMany({
      where: {
        OR: [
          { name: { contains: 'Finance', mode: 'insensitive' } },
          { name: { contains: 'Accounting', mode: 'insensitive' } }
        ]
      },
      select: { department_id: true }
    });
    const financeDeptIds = financeDepts.map((d) => d.department_id);

    const financeReviewers = await prisma.employee.findMany({
      where: {
        OR: [
          { role: 'ADMIN' },
          ...(financeDeptIds.length > 0 ? [{ department_id: { in: financeDeptIds } }] : [])
        ],
        is_active: true
      },
      select: { emp_id: true }
    });

    const financeNotifs = financeReviewers.map((r) => ({
      emp_id: r.emp_id,
      title: 'Petty Cash Ready for Finance Review',
      message: `Claim #${updated.petty_cash_id} (Rs. ${Number(updated.amount).toFixed(2)} for ${updated.employee?.name || 'Employee'}) received manager approval and awaits Finance review & disbursement.`
    }));

    if (financeNotifs.length > 0) {
      await prisma.notification.createMany({ data: financeNotifs });
    }
  } catch (e) {}

  res.json(updated);
});

// PUT /api/petty-cash/:id/disburse
// Step 2 (Finance Step): Verifies status is 'Pending Finance Approval', transitions to 'Disbursed'.
exports.disburse = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const isFinance = await isUserInFinanceDept(user);

  if (!['ADMIN', 'FINANCE', 'MANAGER'].includes(user.role) && !isFinance) {
    return res.status(403).json({
      error: 'Access forbidden. Only Admins or Finance/Management personnel can disburse funds.'
    });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  if (!['Pending Finance Approval', 'Approved'].includes(existing.status)) {
    return res.status(400).json({
      error: `Cannot disburse funds: claim must have Manager Approval ("Pending Finance Approval") first. Current status is "${existing.status}".`
    });
  }

  const now = new Date();
  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Disbursed',
      finance_approved_by: user.emp_id || null,
      finance_approved_at: now,
      disbursed_at: now
    },
    include: PETTY_CASH_INCLUDE
  });

  enrichPettyCashRecord(updated);

  // Notify the employee
  try {
    await prisma.notification.create({
      data: {
        emp_id: updated.emp_id,
        title: 'Petty Cash Disbursed',
        message: `Petty cash of Rs. ${Number(updated.amount).toFixed(2)} has been approved by Finance and disbursed. Please submit receipts and mark as settled once completed.`
      }
    });
  } catch (e) {}

  res.json(updated);
});

// PUT /api/petty-cash/:id/reject
exports.reject = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const isFinance = await isUserInFinanceDept(user);

  if (!['ADMIN', 'MANAGER', 'FINANCE'].includes(user.role) && !isFinance) {
    return res.status(403).json({ error: 'Access forbidden. Only Managers, Finance, or Admins can reject petty cash.' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const reason = req.body.rejection_reason || req.body.reason;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id },
    include: { task: true, employee: true }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  const now = new Date();
  const updateData = {
    status: 'Rejected',
    rejection_reason: reason.trim(),
    approved_by: user.emp_id || null,
    approved_at: now
  };

  if (existing.status === 'Pending Finance Approval') {
    updateData.finance_approved_by = user.emp_id || null;
    updateData.finance_approved_at = now;
  } else {
    updateData.manager_approved_by = user.emp_id || null;
    updateData.manager_approved_at = now;
  }

  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: updateData,
    include: PETTY_CASH_INCLUDE
  });

  enrichPettyCashRecord(updated);

  // Notify the employee
  try {
    await prisma.notification.create({
      data: {
        emp_id: updated.emp_id,
        title: 'Petty Cash Request Rejected',
        message: `Your petty cash request of Rs. ${Number(updated.amount).toFixed(2)} was rejected. Reason: "${reason.trim()}".`
      }
    });
  } catch (e) {}

  res.json(updated);
});

// PUT /api/petty-cash/:id/settle
exports.settle = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const isFinance = await isUserInFinanceDept(user);
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  const canSettle = user.role === 'ADMIN' || user.role === 'MANAGER' || isFinance || existing.emp_id === user.emp_id;
  if (!canSettle) {
    return res.status(403).json({ error: 'You are not authorized to settle this request.' });
  }

  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Settled'
    },
    include: PETTY_CASH_INCLUDE
  });

  enrichPettyCashRecord(updated);

  // Notify approvers
  try {
    const notifyId = updated.finance_approved_by || updated.manager_approved_by || updated.approved_by;
    if (notifyId) {
      await prisma.notification.create({
        data: {
          emp_id: notifyId,
          title: 'Petty Cash Settled',
          message: `Petty cash of Rs. ${Number(updated.amount).toFixed(2)} for Task ${updated.task?.task_code || '#' + updated.task_id} has been marked as Settled.`
        }
      });
    }
  } catch (e) {}

  res.json(updated);
});

// DELETE /api/petty-cash/:id
exports.remove = asyncHandler(async (req, res) => {
  await ensureTableExists();
  const user = getUserFromReq(req);
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  const isPending = ['Pending Manager Approval', 'Pending'].includes(existing.status);
  if (user.role !== 'ADMIN' && (existing.emp_id !== user.emp_id || !isPending)) {
    return res.status(403).json({ error: 'Cannot delete this petty cash request.' });
  }

  await prisma.pettyCash.delete({
    where: { petty_cash_id: id }
  });

  res.json({ success: true, message: 'Petty cash request deleted successfully' });
});
