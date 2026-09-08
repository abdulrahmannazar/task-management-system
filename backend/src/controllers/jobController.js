const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const job = await prisma.job.create({ 
        data: { 
            ...req.body, 
            deadline: req.body.deadline ? new Date(req.body.deadline) : null 
        } 
    });
    res.status(201).json(job);
});

exports.getAll = asyncHandler(async (req, res) => {
    const jobs = await prisma.job.findMany({ 
        include: { 
            loe: true, 
            manager: true, 
            tasks: true 
        } 
    });
    res.status(200).json(jobs);
});

exports.getById = asyncHandler(async (req, res) => {
    const job = await prisma.job.findUniqueOrThrow({ 
        where: { job_id: parseInt(req.params.id) }, 
        include: { 
            tasks: true, 
            invoice: true 
        } 
    });
    res.status(200).json(job);
});

exports.update = asyncHandler(async (req, res) => {
    const job = await prisma.job.update({ 
        where: { job_id: parseInt(req.params.id) }, 
        data: { 
            ...req.body, 
            deadline: req.body.deadline ? new Date(req.body.deadline) : undefined 
        } 
    });
    res.status(200).json(job);
});

exports.remove = asyncHandler(async (req, res) => { 
    await prisma.job.delete({ 
        where: { job_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});