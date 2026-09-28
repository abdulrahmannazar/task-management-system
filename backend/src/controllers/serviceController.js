const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const deptId = parseInt(req.query.department_id);
  
  const query = {
    orderBy: { service_id: 'desc' }
  };

  if (!isNaN(deptId)) {
    query.where = { department_id: deptId };
  }

  const services = await prisma.service.findMany(query);
  res.json(services);
});

exports.getById = asyncHandler(async (req, res) => {
  const serviceId = parseInt(req.params.id);
  if (isNaN(serviceId)) {
    return res.status(400).json({ error: 'Invalid Service ID' });
  }

  const service = await prisma.service.findUnique({
    where: { service_id: serviceId }
  });

  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

exports.create = asyncHandler(async (req, res) => {
  const { department_id, name, sub_category, scope, billing_type, is_active } = req.body;

  const newService = await prisma.service.create({
    data: {
      department_id: parseInt(department_id),
      name,
      sub_category: sub_category || null,
      scope: scope || null,
      billing_type: billing_type || 'Fixed',
      is_active: is_active !== undefined ? is_active : true
    }
  });

  res.status(201).json(newService);
});

exports.update = asyncHandler(async (req, res) => {
  const serviceId = parseInt(req.params.id);
  if (isNaN(serviceId)) {
    return res.status(400).json({ error: 'Invalid Service ID' });
  }

  const { department_id, name, sub_category, scope, billing_type, is_active } = req.body;

  const updatedService = await prisma.service.update({
    where: { service_id: serviceId },
    data: {
      department_id: department_id !== undefined ? parseInt(department_id) : undefined,
      name: name !== undefined ? name : undefined,
      sub_category: sub_category !== undefined ? sub_category : undefined,
      scope: scope !== undefined ? scope : undefined,
      billing_type: billing_type !== undefined ? billing_type : undefined,
      is_active: is_active !== undefined ? is_active : undefined
    }
  });

  res.json(updatedService);
});

const deleteService = asyncHandler(async (req, res) => {
  const serviceId = parseInt(req.params.id);
  if (isNaN(serviceId)) {
    return res.status(400).json({ error: 'Invalid Service ID' });
  }

  await prisma.service.delete({
    where: { service_id: serviceId }
  });

  res.json({ message: 'Service deleted successfully' });
});

exports.remove = deleteService;
exports.delete = deleteService;