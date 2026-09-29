const prisma = require('../config/db'); 
const asyncHandler = require('../middlewares/asyncHandler');
const { generateLoePdf } = require('../services/pdfService');

// ==========================================
// STANDARD CRUD ENDPOINTS
// ==========================================

exports.getAll = asyncHandler(async (req, res) => {
  const loes = await prisma.loe.findMany({
    include: { 
      company: true,
      loe_items: {
        include: { service: true }
      },
      department_approvals: {
        include: { department: true }
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
        include: { service: true }
      },
      department_approvals: {
        include: { department: true }
      }
    }
  });
  
  if (!loe) return res.status(404).json({ error: 'LOE not found' });
  res.json(loe);
});

exports.create = asyncHandler(async (req, res) => {
  const { company_id, created_by, type, start_date, end_date, loe_items } = req.body;

  // 1. Identify all unique departments involved from the selected services
  const serviceIds = (loe_items || []).map(item => Number(item.service_id));
  const services = await prisma.service.findMany({
    where: { service_id: { in: serviceIds } }
  });
  const departmentIds = [...new Set(services.map(s => s.department_id))];

  // 2. Create the LOE and generate pending approval records for each department
  const newLoe = await prisma.loe.create({
    data: {
      company_id: parseInt(company_id),
      created_by: parseInt(created_by),
      status: 'Approval Pending',
      type: type || 'Standard',
      start_date: new Date(start_date),
      end_date: end_date ? new Date(end_date) : undefined,
      loe_items: { create: loe_items || [] },
      department_approvals: {
        create: departmentIds.map(deptId => ({
          department_id: deptId,
          status: 'Pending'
        }))
      }
    },
    include: { 
      loe_items: { include: { service: true } },
      department_approvals: { include: { department: true } }
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

  // 1. Identify all unique departments involved from updated services
  const serviceIds = (loe_items || []).map(item => Number(item.service_id));
  const services = await prisma.service.findMany({
    where: { service_id: { in: serviceIds } }
  });
  const departmentIds = [...new Set(services.map(s => s.department_id))];

  // 2. Update LOE, rebuild items, and reset department approvals to Pending
  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      company_id: company_id ? parseInt(company_id) : undefined,
      status: 'Approval Pending',
      type: type || 'Standard',
      start_date: start_date ? new Date(start_date) : undefined,
      end_date: end_date ? new Date(end_date) : undefined,
      approved_by: null,
      loe_items: {
        deleteMany: {}, 
        create: loe_items || [] 
      },
      department_approvals: {
        deleteMany: {},
        create: departmentIds.map(deptId => ({
          department_id: deptId,
          status: 'Pending'
        }))
      }
    },
    include: { 
      loe_items: { include: { service: true } },
      department_approvals: { include: { department: true } }
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
// MULTI-DEPARTMENT APPROVAL WORKFLOW
// ==========================================

exports.getPending = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: {
      company: true,
      loe_items: {
        include: { service: true } 
      },
      department_approvals: {
        include: { department: true }
      }
    },
    orderBy: { loe_id: 'desc' }
  };

  if (role === 'ADMIN') {
    // Admin sees all LOEs currently awaiting review
    query.where = { status: 'Approval Pending' };
  } else {
    // Managers ONLY see LOEs where THEIR department's approval is still 'Pending'
    query.where = {
      status: 'Approval Pending',
      department_approvals: {
        some: {
          department_id: deptId,
          status: 'Pending'
        }
      }
    };
  }

  const loes = await prisma.loe.findMany(query);
  res.json(loes);
});

exports.approve = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }

  const { emp_id, role, department_id } = req.body;

  // 1. Admin Super-Approval: Approves all departments and marks LOE as Approved
  if (role === 'ADMIN') {
    await prisma.loeDepartmentApproval.updateMany({
      where: { loe_id: loeId },
      data: {
        status: 'Approved',
        reviewed_by: parseInt(emp_id)
      }
    });

    const updatedLoe = await prisma.loe.update({
      where: { loe_id: loeId },
      data: {
        status: 'Approved',
        approved_by: parseInt(emp_id)
      },
      include: {
        department_approvals: { include: { department: true } }
      }
    });

    return res.json(updatedLoe);
  }

  // 2. Department Manager Approval: Approves only their specific department
  const deptId = parseInt(department_id);
  if (isNaN(deptId)) {
    return res.status(400).json({ error: 'department_id is required for manager approval' });
  }

  await prisma.loeDepartmentApproval.update({
    where: {
      loe_id_department_id: {
        loe_id: loeId,
        department_id: deptId
      }
    },
    data: {
      status: 'Approved',
      reviewed_by: parseInt(emp_id)
    }
  });

  // 3. Check if all required departments have now approved
  const allApprovals = await prisma.loeDepartmentApproval.findMany({
    where: { loe_id: loeId }
  });

  const allApproved = allApprovals.length > 0 && allApprovals.every(a => a.status === 'Approved');

  // Master LOE only becomes 'Approved' when every department approves; otherwise stays 'Approval Pending'
  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      status: allApproved ? 'Approved' : 'Approval Pending',
      approved_by: allApproved ? parseInt(emp_id) : undefined
    },
    include: {
      department_approvals: { include: { department: true } }
    }
  });

  res.json(updatedLoe);
});

exports.reject = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) {
    return res.status(400).json({ error: 'Invalid LOE ID format' });
  }

  const { emp_id, role, department_id } = req.body;

  if (role === 'ADMIN') {
    await prisma.loeDepartmentApproval.updateMany({
      where: { loe_id: loeId },
      data: {
        status: 'Rejected',
        reviewed_by: parseInt(emp_id)
      }
    });
  } else {
    const deptId = parseInt(department_id);
    if (!isNaN(deptId)) {
      await prisma.loeDepartmentApproval.update({
        where: {
          loe_id_department_id: {
            loe_id: loeId,
            department_id: deptId
          }
        },
        data: {
          status: 'Rejected',
          reviewed_by: parseInt(emp_id)
        }
      });
    }
  }

  // Setting the main LOE status to 'Rejected' allows the creator to edit and resubmit
  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: 'Rejected' },
    include: {
      department_approvals: { include: { department: true } }
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