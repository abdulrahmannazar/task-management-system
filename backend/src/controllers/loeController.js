const prisma = require('../config/db'); 
const asyncHandler = require('../middlewares/asyncHandler');
const { generateLoePdf } = require('../services/pdfService');

exports.getAll = asyncHandler(async (req, res) => {
  const loes = await prisma.loe.findMany({
    include: { 
      company: true,
      loe_items: {
        include: { 
          service: {
            include: { department: true }
          } 
        }
      } 
    },
    orderBy: { loe_id: 'desc' }
  });
  res.json(loes);
});

exports.getById = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }

  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { 
      company: true,
      loe_items: {
        include: { 
          service: {
            include: { department: true }
          } 
        }
      } 
    }
  });
  
  if (!loe) return res.status(404).json({ error: 'LOE not found' });
  res.json(loe);
});

exports.create = asyncHandler(async (req, res) => {
  const { company_id, created_by, type, start_date, end_date, loe_items } = req.body;

  const newLoe = await prisma.loe.create({
    data: {
      company_id: parseInt(company_id),
      created_by: parseInt(created_by),
      status: 'Approval Pending',
      type: type || 'Standard',
      start_date: new Date(start_date),
      end_date: end_date ? new Date(end_date) : undefined,
      loe_items: { 
        create: (loe_items || []).map(item => ({
          service_id: Number(item.service_id),
          custom_scope: item.custom_scope || null,
          amount: Number(item.amount || 0),
          status: 'Pending',
          rejection_reason: null
        }))
      }
    },
    include: { 
      company: true,
      loe_items: { include: { service: true } }
    }
  });
  
  res.status(201).json(newLoe);
});

exports.update = asyncHandler(async (req, res) => {
  const { company_id, type, start_date, end_date, loe_items } = req.body;
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }

  // Preserve 'Approved' items; reset 'Rejected' or newly added items to 'Pending'
  const itemsToCreate = (loe_items || []).map(item => {
    const isApproved = item.status === 'Approved';
    return {
      service_id: Number(item.service_id),
      custom_scope: item.custom_scope || null,
      amount: Number(item.amount || 0),
      status: isApproved ? 'Approved' : 'Pending',
      rejection_reason: isApproved ? null : null
    };
  });

  const allApproved = itemsToCreate.length > 0 && itemsToCreate.every(i => i.status === 'Approved');

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      company_id: company_id ? parseInt(company_id) : undefined,
      status: allApproved ? 'Approved' : 'Approval Pending',
      type: type || 'Standard',
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      approved_by: allApproved ? undefined : null,
      loe_items: {
        deleteMany: {}, 
        create: itemsToCreate
      }
    },
    include: { 
      company: true,
      loe_items: { include: { service: true } }
    }
  });

  res.json(updatedLoe);
});

const deleteLoe = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }
  await prisma.loe.delete({ where: { loe_id: loeId } });
  res.json({ message: 'LOE deleted successfully' });
});

exports.remove = deleteLoe;
exports.delete = deleteLoe;

// ==========================================
// ITEM-LEVEL & BATCH APPROVAL WORKFLOW
// ==========================================

exports.getPending = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: {
      company: true,
      loe_items: {
        include: { 
          service: {
            include: { department: true }
          }
        } 
      }
    },
    orderBy: { loe_id: 'desc' }
  };

  if (role === 'ADMIN') {
    // Admin sees all LOEs currently in 'Approval Pending'
    query.where = { status: 'Approval Pending' };
  } else {
    // Managers only see LOEs with at least one Pending service in their department
    query.where = {
      status: 'Approval Pending',
      loe_items: {
        some: {
          service: { department_id: deptId },
          status: 'Pending'
        }
      }
    };
  }

  const loes = await prisma.loe.findMany(query);
  res.json(loes);
});

exports.approveItem = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const { emp_id } = req.body;

  if (isNaN(loeId) || isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid ID parameters' });
  }

  // 1. Mark this specific service item as Approved
  await prisma.loeItem.update({
    where: { loe_item_id: itemId },
    data: { 
      status: 'Approved', 
      rejection_reason: null 
    }
  });

  // 2. Re-evaluate all items belonging to this LOE
  const allItems = await prisma.loeItem.findMany({
    where: { loe_id: loeId }
  });

  const allApproved = allItems.every(i => i.status === 'Approved');
  const hasRejected = allItems.some(i => i.status === 'Rejected');

  let newLoeStatus = 'Approval Pending';
  if (allApproved) {
    newLoeStatus = 'Approved';
  } else if (hasRejected) {
    newLoeStatus = 'Rejected';
  }

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      status: newLoeStatus,
      approved_by: allApproved ? parseInt(emp_id) : undefined
    },
    include: {
      company: true,
      loe_items: {
        include: { service: { include: { department: true } } }
      }
    }
  });

  res.json(updatedLoe);
});

exports.rejectItem = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const { reason } = req.body;

  if (isNaN(loeId) || isNaN(itemId)) {
    return res.status(400).json({ error: 'Invalid ID parameters' });
  }

  // 1. Mark this specific service item as Rejected with reason
  await prisma.loeItem.update({
    where: { loe_item_id: itemId },
    data: {
      status: 'Rejected',
      rejection_reason: reason || 'Revision required by department manager'
    }
  });

  // 2. Reject the overall LOE so it can be revised and resubmitted
  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: 'Rejected' },
    include: {
      company: true,
      loe_items: {
        include: { service: { include: { department: true } } }
      }
    }
  });

  res.json(updatedLoe);
});

exports.approveAll = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  const { emp_id } = req.body;

  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID' });
  }

  // Admin super-approval: marks all service items as Approved
  await prisma.loeItem.updateMany({
    where: { loe_id: loeId },
    data: { status: 'Approved', rejection_reason: null }
  });

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      status: 'Approved',
      approved_by: emp_id ? parseInt(emp_id) : undefined
    },
    include: {
      company: true,
      loe_items: {
        include: { service: { include: { department: true } } }
      }
    }
  });

  res.json(updatedLoe);
});

// ==========================================
// PDF GENERATION ENDPOINT
// ==========================================

exports.generatePdf = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }

  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: {
      loe_items: {
        include: { service: true }
      }
    }
  });

  if (!loe) {
    return res.status(404).json({ error: 'LOE record not found' });
  }

  const company = await prisma.company.findUnique({
    where: { company_id: loe.company_id }
  });

  const pdfBuffer = await generateLoePdf({ loe, company });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=LOE-${loe.loe_id}.pdf`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});