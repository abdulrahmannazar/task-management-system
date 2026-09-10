const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {};
  if (role !== 'ADMIN') {
        if (!isNaN(deptId)) {
        query.where = { department_id: deptId };
    }
  }

  const services = await prisma.service.findMany({
    ...query,
    orderBy: { service_id: 'desc' }
  });
  res.json(services);
});


exports.create = asyncHandler(async (req, res) => {
  const { department_id, name, sub_category, billing_type, is_active } = req.body;

  const newService = await prisma.service.create({
    data: {
      department_id: parseInt(department_id),
      name,
      sub_category,
      billing_type,
      is_active: is_active ?? true
    }
  });
  
  res.status(201).json(newService);
});

exports.update = asyncHandler(async (req, res) => {
  const { department_id, name, sub_category, billing_type, is_active } = req.body;
  const serviceId = parseInt(req.params.id);

  const updatedService = await prisma.service.update({
    where: { service_id: serviceId },
    data: {
      department_id: parseInt(department_id),
      name,
      sub_category,
      billing_type,
      is_active
    }
  });

  res.json(updatedService);
});

exports.remove = asyncHandler(async (req, res) => {
  const serviceId = parseInt(req.params.id);
  await prisma.service.delete({ where: { service_id: serviceId } });
  res.json({ message: 'Service deleted successfully' });
});

exports.delete = exports.remove;
exports.getById = asyncHandler(async (req, res) => {
  const service = await prisma.service.findUnique({ where: { service_id: parseInt(req.params.id) } });
  res.json(service);
});