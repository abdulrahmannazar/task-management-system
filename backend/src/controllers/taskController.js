const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const task = await prisma.task.create({ 
        data: { ...req.body, deadline: req.body.deadline ? new Date(req.body.deadline) : null } 
    });
    res.status(201).json(task);
});

exports.getAll = asyncHandler(async (req, res) => {
    const query = {};
    
    // RBAC: Lock standard employees to their own assigned tasks
    if (req.user.role === 'EMPLOYEE') {
        query.assigned_to = req.user.emp_id;
    }

    const tasks = await prisma.task.findMany({ 
        where: query,
        include: { service: true, assignee: { select: { name: true, email: true } } } 
    });
    res.status(200).json(tasks);
});

exports.getById = asyncHandler(async (req, res) => {
    const task = await prisma.task.findUniqueOrThrow({ 
        where: { task_id: parseInt(req.params.id) },
        include: { service: true }
    });
    
    // RBAC: Prevent employee from viewing a specific task not assigned to them
    if (req.user.role === 'EMPLOYEE' && task.assigned_to !== req.user.emp_id) {
        return res.status(403).json({ error: 'Access forbidden. Task not assigned to you.' });
    }
    
    res.status(200).json(task);
});

exports.update = asyncHandler(async (req, res) => {
    const task = await prisma.task.update({ 
        where: { task_id: parseInt(req.params.id) }, 
        data: { ...req.body, deadline: req.body.deadline ? new Date(req.body.deadline) : undefined } 
    });
    res.status(200).json(task);
});

exports.remove = asyncHandler(async (req, res) => { 
    await prisma.task.delete({ where: { task_id: parseInt(req.params.id) } });
    res.status(204).send(); 
});