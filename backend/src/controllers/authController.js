const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, department_id, role } = req.body;

  if (!name || !email || !password || !department_id) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  // Check if user already exists
  const existingUser = await prisma.employee.findUnique({
    where: { email }
  });

  if (existingUser) {
    return res.status(400).json({ error: 'Email is already registered' });
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Validate and assign correct role (defaults to EMPLOYEE if not specified)
  const assignedRole = (role && ['ADMIN', 'MANAGER', 'EMPLOYEE'].includes(role.toUpperCase()))
    ? role.toUpperCase()
    : 'EMPLOYEE';

  const newEmployee = await prisma.employee.create({
    data: {
      name,
      email,
      password: hashedPassword,
      department_id: parseInt(department_id),
      role: assignedRole,
      is_active: true
    },
    include: { department: true }
  });

  const token = jwt.sign(
    { 
      emp_id: newEmployee.emp_id, 
      role: newEmployee.role, 
      department_id: newEmployee.department_id 
    },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: '7d' }
  );

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      emp_id: newEmployee.emp_id,
      name: newEmployee.name,
      email: newEmployee.email,
      role: newEmployee.role,
      department_id: newEmployee.department_id,
      department_name: newEmployee.department?.name
    }
  });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password' });
  }

  // Find employee and explicitly include department
  const employee = await prisma.employee.findUnique({
    where: { email },
    include: { department: true }
  });

  if (!employee) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!employee.is_active) {
    return res.status(403).json({ error: 'Account has been deactivated' });
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, employee.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Generate JWT with actual database role
  const token = jwt.sign(
    { 
      emp_id: employee.emp_id, 
      role: employee.role, 
      department_id: employee.department_id 
    },
    process.env.JWT_SECRET || 'your_jwt_secret',
    { expiresIn: '7d' }
  );

  // Return the actual role from the database record
  res.json({
    message: 'Login successful',
    token,
    user: {
      emp_id: employee.emp_id,
      name: employee.name,
      email: employee.email,
      role: employee.role, // Must be the database value ('MANAGER', 'EMPLOYEE', or 'ADMIN')
      department_id: employee.department_id,
      department_name: employee.department?.name
    }
  });
});

// GET /api/auth/departments
exports.getDepartments = asyncHandler(async (req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { department_id: 'asc' }
  });
  res.json(departments);
});