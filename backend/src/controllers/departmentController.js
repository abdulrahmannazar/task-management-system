const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

let cachedDepartments = null;
let lastDeptFetch = 0;
const DEPT_CACHE_TTL = 5 * 60 * 1000;

exports.create = asyncHandler(async (req, res) => {
    cachedDepartments = null;
    const department = await prisma.department.create({ 
        data: req.body 
    });
    res.status(201).json(department);
});

exports.getAll = asyncHandler(async (req, res) => {
    const now = Date.now();
    if (cachedDepartments && (now - lastDeptFetch < DEPT_CACHE_TTL)) {
        return res.status(200).json(cachedDepartments);
    }
    const departments = await prisma.department.findMany();
    cachedDepartments = departments;
    lastDeptFetch = now;
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
    cachedDepartments = null;
    const department = await prisma.department.update({ 
        where: { department_id: parseInt(req.params.id) }, 
        data: req.body 
    });
    res.status(200).json(department);
});

exports.remove = asyncHandler(async (req, res) => {
    cachedDepartments = null;
    await prisma.department.delete({ 
        where: { department_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});
