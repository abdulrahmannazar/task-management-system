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
  const { name, email, phone, address } = req.body;
  const data = { name };
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (address !== undefined) data.address = address;

  const company = await prisma.company.create({ data });
  res.status(201).json(company);
});

exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

  const { name, email, phone, address } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (address !== undefined) data.address = address;

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