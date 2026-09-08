const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const employee = await prisma.employee.create({ 
        data: req.body 
    });
    res.status(201).json(employee);
});

exports.getAll = asyncHandler(async (req, res) => {
    const employees = await prisma.employee.findMany({ 
        include: { department: true } 
    });
    res.status(200).json(employees);
});

exports.getById = asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUniqueOrThrow({ 
        where: { emp_id: parseInt(req.params.id) }, 
        include: { department: true, manager: true, subordinates: true } 
    });
    res.status(200).json(employee);
});

exports.update = asyncHandler(async (req, res) => {
    const employee = await prisma.employee.update({ 
        where: { emp_id: parseInt(req.params.id) }, 
        data: req.body 
    });
    res.status(200).json(employee);
});

exports.remove = asyncHandler(async (req, res) => {
    await prisma.employee.delete({ 
        where: { emp_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});