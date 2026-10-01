const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

// GET /api/services
exports.getAll = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: { department: true },
    orderBy: { service_id: 'desc' }
  };

  if (role !== 'ADMIN' && !isNaN(deptId)) {
    query.where = { department_id: deptId };
  }

  const services = await prisma.service.findMany(query);
  res.json(services);
});

// GET /api/services/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Service ID' });

  const service = await prisma.service.findUnique({
    where: { service_id: id },
    include: { department: true }
  });

  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

// POST /api/services
exports.create = asyncHandler(async (req, res) => {
  const { department_id, name, sub_category, scope, billing_type, price, is_active } = req.body;

  if (!department_id || !name) {
    return res.status(400).json({ error: 'Department and Service Name are required' });
  }

  const newService = await prisma.service.create({
    data: {
      department_id: parseInt(department_id),
      name,
      sub_category: sub_category || null,
      scope: scope || null,
      billing_type: billing_type || 'Fixed',
      price: price !== undefined && price !== '' ? Number(price) : 0.00,
      is_active: is_active !== undefined ? Boolean(is_active) : true
    },
    include: { department: true }
  });

  res.status(201).json(newService);
});

// PUT /api/services/:id
exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Service ID' });

  const { department_id, name, sub_category, scope, billing_type, price, is_active } = req.body;
  const data = {};

  if (department_id !== undefined) data.department_id = parseInt(department_id);
  if (name !== undefined) data.name = name;
  if (sub_category !== undefined) data.sub_category = sub_category;
  if (scope !== undefined) data.scope = scope;
  if (billing_type !== undefined) data.billing_type = billing_type;
  if (price !== undefined && price !== '') data.price = Number(price);
  if (is_active !== undefined) data.is_active = Boolean(is_active);

  const updatedService = await prisma.service.update({
    where: { service_id: id },
    data,
    include: { department: true }
  });

  res.json(updatedService);
});

// DELETE /api/services/:id
const deleteService = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Service ID' });

  await prisma.service.delete({ where: { service_id: id } });
  res.json({ message: 'Service deleted successfully' });
});

exports.remove = deleteService;
exports.delete = deleteService;