const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

// Helper to decode authenticated user from JWT Bearer token
const getRequester = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      if (decoded && decoded.role) return decoded;
    } catch {
      // Fallback if token verification fails
    }
  }

  return {
    role: req.body.requester_role || req.query.role || 'EMPLOYEE',
    department_id: req.body.requester_dept_id || req.query.department_id 
      ? parseInt(req.body.requester_dept_id || req.query.department_id) 
      : null,
    emp_id: req.body.requester_emp_id ? parseInt(req.body.requester_emp_id) : null
  };
};

// GET /api/employees
exports.getAll = asyncHandler(async (req, res) => {
  const requester = getRequester(req);
  const role = req.query.role || requester.role;
  const deptId = parseInt(req.query.department_id || requester.department_id);

  const query = {
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true,
      department_id: true,
      is_active: true,
      department: true
    },
    orderBy: { emp_id: 'desc' }
  };

  // Managers only view their department's employees; Admins view all
  if (role !== 'ADMIN' && !isNaN(deptId)) {
    query.where = { department_id: deptId };
  }

  const employees = await prisma.employee.findMany(query);
  res.json(employees);
});

// GET /api/employees/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Employee ID' });

  const employee = await prisma.employee.findUnique({
    where: { emp_id: id },
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true,
      department_id: true,
      is_active: true,
      department: true
    }
  });

  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  res.json(employee);
});

// POST /api/employees
exports.create = asyncHandler(async (req, res) => {
  const requester = getRequester(req);
  const { name, email, password, department_id, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const isAdmin = requester.role === 'ADMIN';
  const isManager = requester.role === 'MANAGER';

  // Only Admins and Managers have authorization to create staff accounts
  if (!isAdmin && !isManager) {
    return res.status(403).json({ error: 'Access denied. Only Admins and Managers can add staff.' });
  }

  // Check email uniqueness
  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    return res.status(400).json({ error: 'An employee account with this email already exists' });
  }

  let targetDeptId;
  let targetRole;

  if (isAdmin) {
    // Admin can select any department and assign EMPLOYEE, MANAGER, or ADMIN
    targetDeptId = parseInt(department_id);
    targetRole = (role && ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role.toUpperCase()))
      ? role.toUpperCase()
      : 'EMPLOYEE';
  } else {
    // Manager is locked to their own department and can ONLY create EMPLOYEE accounts
    targetDeptId = requester.department_id;
    targetRole = 'EMPLOYEE';
  }

  if (!targetDeptId || isNaN(targetDeptId)) {
    return res.status(400).json({ error: 'A valid department assignment is required' });
  }

  // Hash the manual password with bcryptjs
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newEmployee = await prisma.employee.create({
    data: {
      name,
      email,
      password: hashedPassword,
      department_id: targetDeptId,
      role: targetRole,
      manager_id: isManager ? requester.emp_id : undefined,
      is_active: true
    },
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true,
      department_id: true,
      is_active: true,
      department: true
    }
  });

  res.status(201).json(newEmployee);
});

// PUT /api/employees/:id
exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Employee ID' });

  const requester = getRequester(req);
  const isAdmin = requester.role === 'ADMIN';
  const isManager = requester.role === 'MANAGER';

  if (!isAdmin && !isManager) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { name, email, password, department_id, role, is_active } = req.body;
  const data = {};

  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (is_active !== undefined) data.is_active = is_active;

  // Password reset (only hash if a new password string was provided)
  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(10);
    data.password = await bcrypt.hash(password, salt);
  }

  // Only Admins can modify department assignment or role
  if (isAdmin) {
    if (department_id !== undefined) data.department_id = parseInt(department_id);
    if (role !== undefined) data.role = role.toUpperCase();
  }

  const updated = await prisma.employee.update({
    where: { emp_id: id },
    data,
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true,
      department_id: true,
      is_active: true,
      department: true
    }
  });

  res.json(updated);
});

// DELETE /api/employees/:id
const deleteEmployee = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Employee ID' });

  await prisma.employee.delete({ where: { emp_id: id } });
  res.json({ message: 'Employee deleted successfully' });
});

exports.remove = deleteEmployee;
exports.delete = deleteEmployee;