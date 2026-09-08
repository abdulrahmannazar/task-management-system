const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const company = await prisma.company.create({ 
        data: req.body 
    });
    res.status(201).json(company);
});

exports.getAll = asyncHandler(async (req, res) => {
    const companies = await prisma.company.findMany();
    res.status(200).json(companies);
});

exports.getById = asyncHandler(async (req, res) => {
    const company = await prisma.company.findUniqueOrThrow({ 
        where: { company_id: parseInt(req.params.id) }, 
        include: { loes: true } 
    });
    res.status(200).json(company);
});

exports.update = asyncHandler(async (req, res) => {
    const company = await prisma.company.update({ 
        where: { company_id: parseInt(req.params.id) }, 
        data: req.body 
    });
    res.status(200).json(company);
});

exports.remove = asyncHandler(async (req, res) => { 
    await prisma.company.delete({ 
        where: { company_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});