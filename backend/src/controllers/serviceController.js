const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const service = await prisma.service.create({ 
        data: req.body 
    });
    res.status(201).json(service);
});

exports.getAll = asyncHandler(async (req, res) => {
    const services = await prisma.service.findMany({ 
        include: { department: true } 
    });
    res.status(200).json(services);
});

exports.getById = asyncHandler(async (req, res) => {
    const service = await prisma.service.findUniqueOrThrow({ 
        where: { service_id: parseInt(req.params.id) } 
    });
    res.status(200).json(service);
});

exports.update = asyncHandler(async (req, res) => {
    const service = await prisma.service.update({ 
        where: { service_id: parseInt(req.params.id) }, 
        data: req.body 
    });
    res.status(200).json(service);
});

exports.remove = asyncHandler(async (req, res) => { 
    await prisma.service.delete({ 
        where: { service_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});