const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const companies = await prisma.company.findMany({
    orderBy: { company_id: 'desc' }
  });
  res.json(companies);
});

exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const company = await prisma.company.findUnique({
    where: { company_id: id }
  });

  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json(company);
});

exports.create = asyncHandler(async (req, res) => {
  const { name, client_type, reg_number, tin_number, email, phone_number } = req.body;

  const data = {
    name,
    client_type: client_type || 'Corporate',
    reg_number: reg_number && reg_number.trim() ? reg_number.trim() : null,
    tin_number: tin_number && tin_number.trim() ? tin_number.trim() : null,
    email: email && email.trim() ? email.trim() : null,
    phone_number: phone_number && phone_number.trim() ? phone_number.trim() : null
  };

  const company = await prisma.company.create({ data });
  res.status(201).json(company);
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { name, client_type, reg_number, tin_number, email, phone_number } = req.body;

  const data = {};
  if (name !== undefined) data.name = name;
  if (client_type !== undefined) data.client_type = client_type;
  if (reg_number !== undefined) data.reg_number = reg_number && reg_number.trim() ? reg_number.trim() : null;
  if (tin_number !== undefined) data.tin_number = tin_number && tin_number.trim() ? tin_number.trim() : null;
  if (email !== undefined) data.email = email && email.trim() ? email.trim() : null;
  if (phone_number !== undefined) data.phone_number = phone_number && phone_number.trim() ? phone_number.trim() : null;

  const company = await prisma.company.update({
    where: { company_id: id },
    data
  });

  res.json(company);
});

const deleteCompany = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  await prisma.company.delete({
    where: { company_id: id }
  });

  res.json({ message: 'Company deleted successfully' });
});

exports.remove = deleteCompany;
exports.delete = deleteCompany;