const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const deptId = parseInt(req.query.department_id);

  const query = {
    where: { is_active: true },
    select: {
      emp_id: true,
      name: true,
      email: true,
      role: true,
      department_id: true,
      department: true
    },
    orderBy: { name: 'asc' }
  };

  if (!isNaN(deptId)) {
    query.where.department_id = deptId;
  }

  const employees = await prisma.employee.findMany(query);
  res.json(employees);
});

exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Employee ID' });

  const employee = await prisma.employee.findUnique({
    where: { emp_id: id },
    include: { department: true }
  });

  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  res.json(employee);
});