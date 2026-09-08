const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const task = await prisma.task.create({ 
        data: { 
            ...req.body, 
            deadline: req.body.deadline ? new Date(req.body.deadline) : null 
        } 
    });
    res.status(201).json(task);
});

exports.getAll = asyncHandler(async (req, res) => {
    const tasks = await prisma.task.findMany({ 
        include: { 
            service: true, 
            assignee: true 
        } 
    });
    res.status(200).json(tasks);
});

exports.getById = asyncHandler(async (req, res) => {
    const task = await prisma.task.findUniqueOrThrow({ 
        where: { task_id: parseInt(req.params.id) } 
    });
    res.status(200).json(task);
});

exports.update = asyncHandler(async (req, res) => {
    const task = await prisma.task.update({ 
        where: { task_id: parseInt(req.params.id) }, 
        data: { 
            ...req.body, 
            deadline: req.body.deadline ? new Date(req.body.deadline) : undefined 
        } 
    });
    res.status(200).json(task);
});

exports.remove = asyncHandler(async (req, res) => { 
    await prisma.task.delete({ 
        where: { task_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});