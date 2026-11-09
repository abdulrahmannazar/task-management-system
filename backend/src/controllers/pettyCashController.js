const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');
const { generateTaskCode } = require('../utils/taskCodeHelper');

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
 * Helper to compute task code safely
 */
const enrichTaskCode = (task) => {
  if (!task) return null;
  if (task.task_code) return String(task.task_code).toUpperCase();
  const companyName = task.job?.loe?.company?.name || 'CMP';
  const scopeOrService = task.scope || task.service?.name;
  return generateTaskCode(companyName, scopeOrService, task.task_id).toUpperCase();
};

// GET /api/petty-cash
// Standard employees receive only their own petty cash records.
// Managers receive records for tasks in their department.
// Admins receive all records.
exports.getAll = asyncHandler(async (req, res) => {
  const user = getUserFromReq(req);
  const role = user.role;
  const deptId = user.department_id;
  const empId = user.emp_id;

  const query = {
    include: {
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
      }
    },
    orderBy: { petty_cash_id: 'desc' }
  };

  if (role === 'ADMIN') {
    // Admin receives all records
  } else if (role === 'MANAGER') {
    // Managers receive records for tasks in their department OR created by them
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
    // Standard employee: receives only their own records
    if (!empId) {
      return res.status(401).json({ error: 'User identification required' });
    }
    query.where = { emp_id: empId };
  }

  const requests = await prisma.pettyCash.findMany(query);

  const enriched = requests.map((pc) => {
    if (pc.task) {
      pc.task.task_code = enrichTaskCode(pc.task);
    }
    return pc;
  });

  res.json(enriched);
});

// GET /api/petty-cash/allocated-tasks
// Returns active tasks allocated to the current user (or all active if Admin/Manager)
exports.getAllocatedTasks = asyncHandler(async (req, res) => {
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
    // Admin can select any active task
    query.where = { status: { not: 'Completed' } };
  } else if (role === 'MANAGER') {
    // Manager can select department tasks or tasks assigned to them
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
    // Employee: must be actively assigned to the task
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
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const record = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id },
    include: {
      employee: {
        select: {
          emp_id: true,
          name: true,
          email: true,
          department_id: true,
          department: true
        }
      },
      task: {
        include: {
          service: { include: { department: true } },
          job: {
            include: {
              loe: { include: { company: true } }
            }
          },
          assignees: true
        }
      },
      approver: {
        select: {
          emp_id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  });

  if (!record) return res.status(404).json({ error: 'Petty Cash record not found' });
  if (record.task) record.task.task_code = enrichTaskCode(record.task);

  res.json(record);
});

// POST /api/petty-cash
// Validates emp_id, task_id, amount, category, purpose, and date_required.
// Verifies that emp_id is an assignee on task_id (unless requester is Admin).
exports.create = asyncHandler(async (req, res) => {
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

  // 3. Create Petty Cash record
  const newRequest = await prisma.pettyCash.create({
    data: {
      emp_id: empId,
      task_id: parsedTaskId,
      amount: parsedAmount,
      category: category.trim(),
      purpose: purpose.trim(),
      date_required: parsedDate,
      status: 'Pending'
    },
    include: {
      employee: {
        select: {
          emp_id: true,
          name: true,
          email: true,
          department_id: true
        }
      },
      task: {
        include: {
          service: true,
          job: {
            include: { loe: { include: { company: true } } }
          }
        }
      }
    }
  });

  if (newRequest.task) {
    newRequest.task.task_code = enrichTaskCode(newRequest.task);
  }

  // 4. In-App Notification to Department Manager or Admins
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
      message: `${newRequest.employee?.name || 'Employee'} submitted a petty cash request of Rs. ${parsedAmount.toFixed(2)} for Task ${newRequest.task?.task_code || '#' + parsedTaskId} (${category.trim()}).`
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
// Only ADMIN or MANAGER can approve. Updates status to Approved.
exports.approve = asyncHandler(async (req, res) => {
  const user = getUserFromReq(req);
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return res.status(403).json({ error: 'Access forbidden. Only Managers and Admins can approve petty cash.' });
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

  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Approved',
      approved_by: user.emp_id || null,
      approved_at: new Date()
    },
    include: {
      employee: true,
      task: true,
      approver: {
        select: { emp_id: true, name: true, role: true }
      }
    }
  });

  // Notify the employee
  try {
    await prisma.notification.create({
      data: {
        emp_id: updated.emp_id,
        title: 'Petty Cash Request Approved',
        message: `Your petty cash request of Rs. ${Number(updated.amount).toFixed(2)} has been approved. Awaiting physical disbursement.`
      }
    });
  } catch (e) {}

  res.json(updated);
});

// PUT /api/petty-cash/:id/reject
// Only ADMIN or MANAGER can reject. Requires a reason string.
exports.reject = asyncHandler(async (req, res) => {
  const user = getUserFromReq(req);
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return res.status(403).json({ error: 'Access forbidden. Only Managers and Admins can reject petty cash.' });
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

  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Rejected',
      rejection_reason: reason.trim(),
      approved_by: user.emp_id || null,
      approved_at: new Date()
    },
    include: {
      employee: true,
      task: true,
      approver: {
        select: { emp_id: true, name: true, role: true }
      }
    }
  });

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

// PUT /api/petty-cash/:id/disburse
// Updates status to Disbursed.
exports.disburse = asyncHandler(async (req, res) => {
  const user = getUserFromReq(req);
  if (!['ADMIN', 'MANAGER'].includes(user.role)) {
    return res.status(403).json({ error: 'Access forbidden. Only authorized roles can disburse petty cash.' });
  }

  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Disbursed',
      disbursed_at: new Date()
    },
    include: {
      employee: true,
      task: true,
      approver: {
        select: { emp_id: true, name: true, role: true }
      }
    }
  });

  // Notify the employee
  try {
    await prisma.notification.create({
      data: {
        emp_id: updated.emp_id,
        title: 'Petty Cash Disbursed',
        message: `Petty cash of Rs. ${Number(updated.amount).toFixed(2)} has been disbursed. Please submit receipts and mark as settled once completed.`
      }
    });
  } catch (e) {}

  res.json(updated);
});

// PUT /api/petty-cash/:id/settle
// Updates status to Settled.
exports.settle = asyncHandler(async (req, res) => {
  const user = getUserFromReq(req);
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  // Employee who requested it, or Admin/Manager can mark it settled
  const canSettle = user.role === 'ADMIN' || user.role === 'MANAGER' || existing.emp_id === user.emp_id;
  if (!canSettle) {
    return res.status(403).json({ error: 'You are not authorized to settle this request.' });
  }

  const updated = await prisma.pettyCash.update({
    where: { petty_cash_id: id },
    data: {
      status: 'Settled'
    },
    include: {
      employee: true,
      task: true,
      approver: {
        select: { emp_id: true, name: true, role: true }
      }
    }
  });

  // Notify approver/admin
  try {
    if (updated.approved_by) {
      await prisma.notification.create({
        data: {
          emp_id: updated.approved_by,
          title: 'Petty Cash Settled',
          message: `Petty cash of Rs. ${Number(updated.amount).toFixed(2)} for Task #${updated.task_id} has been marked as Settled.`
        }
      });
    }
  } catch (e) {}

  res.json(updated);
});

// DELETE /api/petty-cash/:id
exports.remove = asyncHandler(async (req, res) => {
  const user = getUserFromReq(req);
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Petty Cash ID' });

  const existing = await prisma.pettyCash.findUnique({
    where: { petty_cash_id: id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Petty cash record not found' });
  }

  // Only Admin or the requester (if still pending) can delete
  if (user.role !== 'ADMIN' && (existing.emp_id !== user.emp_id || existing.status !== 'Pending')) {
    return res.status(403).json({ error: 'Cannot delete this petty cash request.' });
  }

  await prisma.pettyCash.delete({
    where: { petty_cash_id: id }
  });

  res.json({ success: true, message: 'Petty cash request deleted successfully' });
});
