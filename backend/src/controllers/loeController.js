const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const { company_id, created_by, status, type, start_date, end_date, loe_items } = req.body;
    
    const loe = await prisma.loe.create({
        data: {
            company_id, 
            created_by, 
            status, 
            type,
            start_date: new Date(start_date),
            end_date: end_date ? new Date(end_date) : null,
            loe_items: { 
                create: loe_items 
            } 
        },
        include: { 
            loe_items: true 
        }
    });
    
    res.status(201).json(loe);
});

exports.getAll = asyncHandler(async (req, res) => {
    const loes = await prisma.loe.findMany({ 
        include: { 
            company: true, 
            creator: true 
        } 
    });
    res.status(200).json(loes);
});

exports.getById = asyncHandler(async (req, res) => {
    const loe = await prisma.loe.findUniqueOrThrow({ 
        where: { loe_id: parseInt(req.params.id) }, 
        include: { 
            loe_items: { include: { service: true } }, 
            company: true 
        } 
    });
    res.status(200).json(loe);
});

exports.update = asyncHandler(async (req, res) => {
    const { company_id, status, type, start_date, end_date, loe_items } = req.body;
    const loeId = parseInt(req.params.id);
    
    const updateLoe = prisma.loe.update({
        where: { loe_id: loeId },
        data: {
            company_id, 
            status, 
            type,
            start_date: start_date ? new Date(start_date) : undefined,
            end_date: end_date ? new Date(end_date) : undefined,
            loe_items: {
                deleteMany: {}, // Clear old items
                create: loe_items // Insert new items
            }
        },
        include: { loe_items: true }
    });
    
    const result = await prisma.$transaction([updateLoe]);
    res.status(200).json(result[0]);
});

exports.remove = asyncHandler(async (req, res) => { 
    await prisma.loe.delete({ 
        where: { loe_id: parseInt(req.params.id) } 
    });
    res.status(204).send(); 
});