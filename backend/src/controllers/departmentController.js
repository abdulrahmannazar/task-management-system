const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const department = await prisma.department.create({ 
        data: req.body 
    });
    res.status(201).json(department);
});

exports.getAll = asyncHandler(async (req, res) => {
    const departments = await prisma.department.findMany();
    res.status(200).json(departments);
});

exports.getById = asyncHandler(async (req, res) => {
    const department = await prisma.department.findUniqueOrThrow({ 
        where: { department_id: parseInt(req.params.id) }, 
        include: { employees: true } 
    });
    res.status(200).json(department);
});

exports.update = asyncHandler(async (req, res) => {
    const department = await prisma.department.update({ 
        where: { department_id: parseInt(req.params.id) }, 
        data: req.body 
    });
    res.status(200).json(department);
});

exports.remove = asyncHandler(async (req, res) => {
    await prisma.department.delete({ 
        where: { department_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});