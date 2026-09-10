const prisma = require('../config/db'); 
const asyncHandler = require('../middlewares/asyncHandler');

// ==========================================
// STANDARD CRUD ENDPOINTS
// ==========================================

exports.getAll = asyncHandler(async (req, res) => {
  const loes = await prisma.loe.findMany({
    include: { loe_items: true },
    orderBy: { loe_id: 'desc' }
  });
  res.json(loes);
});

exports.getById = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  
  // Add this safeguard to block 'NaN'
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }

  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { loe_items: true }
  });
  
  if (!loe) return res.status(404).json({ error: 'LOE not found' });
  res.json(loe);
});

exports.create = asyncHandler(async (req, res) => {
  const { company_id, created_by, status, type, start_date, end_date, loe_items } = req.body;

  const newLoe = await prisma.loe.create({
    data: {
      company_id: parseInt(company_id),
      created_by: parseInt(created_by),
      status,
      type,
      start_date: new Date(start_date),
      end_date: end_date ? new Date(end_date) : undefined,
      loe_items: { create: loe_items || [] }
    },
    include: { loe_items: true }
  });
  
  res.status(201).json(newLoe);
});

exports.update = asyncHandler(async (req, res) => {
  const { company_id, status, type, start_date, end_date, loe_items } = req.body;
  const loeId = parseInt(req.params.id);

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      company_id: company_id ? parseInt(company_id) : undefined,
      status,
      type,
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      loe_items: {
        deleteMany: {}, 
        create: loe_items || [] 
      }
    },
    include: { loe_items: true }
  });

  res.json(updatedLoe);
});

const deleteLoe = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  await prisma.loe.delete({ where: { loe_id: loeId } });
  res.json({ message: 'LOE deleted successfully' });
});

exports.remove = deleteLoe;
exports.delete = deleteLoe;

// ==========================================
// APPROVAL WORKFLOW ENDPOINTS
// ==========================================

exports.getPending = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    // Fetch Pending, Approved, and Rejected LOEs (everything except Drafts)
    where: { 
      status: { in: ['Approval Pending', 'Approved', 'Rejected'] } 
    },
    include: {
      loe_items: {
        include: { service: true } 
      }
    },
    orderBy: { loe_id: 'desc' } // Newest first
  };

  // If NOT Admin, restrict to the manager's specific department
  if (role !== 'ADMIN') {
    query.where.loe_items = {
      some: { service: { department_id: deptId } }
    };
    query.include.loe_items.where = {
      service: { department_id: deptId }
    };
  }

  const loes = await prisma.loe.findMany(query);
  res.json(loes);
});

exports.approve = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  const { emp_id } = req.body;

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      status: 'Approved',
      approved_by: parseInt(emp_id)
    }
  });

  res.json(updatedLoe);
});

exports.reject = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  
  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: 'Rejected' }
  });
  
  res.json(updatedLoe);
});