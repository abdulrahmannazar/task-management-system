const loeCache = new Map();
const LOE_CACHE_TTL = 8000;
const clearLoeCache = () => loeCache.clear();
const prisma = require('../config/db'); 
const asyncHandler = require('../middlewares/asyncHandler');
const { generateLoePdf } = require('../services/pdfService');
const { generateTaskCode, enrichLoeWithCode } = require('../utils/taskCodeHelper');
const { sendLoeCreatedEmail, sendInvoiceCreatedEmail, sendLoeRejectedEmail, sendLoeDispatchToClientEmail } = require('../services/emailService');


async function notifyManagersOfLoeRejection(loe, reason, reviewerId) {
  try {
    const enriched = enrichLoeWithCode(loe);
    let reviewerName = 'Reviewing Authority';
    if (reviewerId) {
      const reviewer = await prisma.employee.findUnique({
        where: { emp_id: parseInt(reviewerId) },
        select: { name: true }
      });
      if (reviewer?.name) reviewerName = reviewer.name;
    }

    const deptIds = [...new Set(
      (loe.loe_items || [])
        .map(i => i.service?.department_id)
        .filter(Boolean)
    )];

    const managers = await prisma.employee.findMany({
      where: {
        OR: [
          { role: 'MANAGER', department_id: { in: deptIds } },
          { role: 'ADMIN' },
          { emp_id: loe.created_by }
        ],
        is_active: true
      },
      select: { emp_id: true, name: true, email: true }
    });

    const uniqueRecipients = new Map();
    managers.forEach(m => uniqueRecipients.set(m.emp_id, m));

    for (const recipient of uniqueRecipients.values()) {
      await sendLoeRejectedEmail({
        toEmail: recipient.email,
        recipientName: recipient.name,
        companyName: loe.company?.name || 'Client',
        loeId: loe.loe_id,
        loeCode: enriched.loe_code,
        reason: reason || 'Revision required',
        reviewerName: reviewerName
      });

      await prisma.notification.create({
        data: {
          emp_id: recipient.emp_id,
          title: 'LOE Rejection Notification',
          message: `${enriched.loe_code} for ${loe.company?.name} was rejected by ${reviewerName}. Reason: ${reason || 'Revision required'}`
        }
      });
    }
  } catch (err) {
    console.error('Error in notifyManagersOfLoeRejection:', err.message);
  }
}

async function getManagersAndAdmins() {
  return prisma.employee.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, is_active: true },
    select: { emp_id: true, name: true, email: true }
  });
}

async function processApprovedLoe(loeId, managerEmpId) {
  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { 
      company: true,
      creator: true,
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });
  if (!loe) return;

  const currency = loe.currency || 'LKR';

  let job = await prisma.job.findUnique({ where: { loe_id: loeId } });

  if (!job) {
    job = await prisma.job.create({
      data: {
        loe_id: loeId,
        manager_id: managerEmpId ? parseInt(managerEmpId) : loe.created_by,
        status: 'In-Progress'
      }
    });
  }

  for (let i = 0; i < loe.loe_items.length; i++) {
    const item = loe.loe_items[i];
    const existingTask = await prisma.task.findFirst({
      where: { job_id: job.job_id, service_id: item.service_id, scope: item.custom_scope }
    });

    if (!existingTask) {
      const taskCode = generateTaskCode(
        loe.company?.name,
        item.custom_scope || item.service?.name,
        i + 1
      );

      await prisma.task.create({
        data: {
          task_code: taskCode,
          job_id: job.job_id,
          service_id: item.service_id,
          scope: item.custom_scope,
          status: 'Pending',
          deadline: null,
          service_deadline: null
        }
      });
    }
  }

  const totalAmount = (loe.loe_items || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  
  const existingInvoice = await prisma.invoice.findFirst({
    where: { job_id: job.job_id },
    orderBy: { issued_date: 'desc' }
  });

  if (!existingInvoice) {
    const issuedDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(issuedDate.getDate() + 30);

    const newInvoice = await prisma.invoice.create({
      data: {
        job_id: job.job_id,
        total_amount: totalAmount,
        status: 'Not Paid',
        issued_date: issuedDate,
        due_date: dueDate
      }
    });

    const leaders = await getManagersAndAdmins();
    for (const leader of leaders) {
      sendInvoiceCreatedEmail(
        leader.email,
        leader.name,
        loe.company.name,
        newInvoice.invoice_id,
        totalAmount,
        dueDate,
        currency
      );
      await prisma.notification.create({
        data: {
          emp_id: leader.emp_id,
          title: 'Invoice Generated',
          message: `INV-${String(newInvoice.invoice_id).padStart(5, '0')} for ${loe.company.name} (${currency} ${Number(totalAmount).toFixed(2)}) has been generated.`
        }
      });
    }
  } else {
    await prisma.invoice.update({
      where: { invoice_id: existingInvoice.invoice_id },
      data: { total_amount: totalAmount }
    });
  }
}

// GET /api/loes
exports.getAll = asyncHandler(async (req, res) => {
  const cacheKey = `${req.query.role}_${req.query.department_id}`;
  const cached = loeCache.get(cacheKey);
  if (cached && (Date.now() - cached.time < LOE_CACHE_TTL)) {
    return res.json(cached.data);
  }
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: { 
      company: true,
      creator: { select: { emp_id: true, name: true, email: true } },
      approver: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } } 
    },
    orderBy: { loe_id: 'desc' }
  };

  if (role !== 'ADMIN' && !isNaN(deptId)) {
    query.where = { loe_items: { some: { service: { department_id: deptId } } } };
  }

  const loes = await prisma.loe.findMany(query);
  const mapped = loes.map(enrichLoeWithCode);
  loeCache.set(cacheKey, { data: mapped, time: Date.now() });
  res.json(mapped);
});

// GET /api/loes/:id
exports.getById = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) return res.status(400).json({ error: 'Invalid LOE ID format' });

  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { 
      company: true,
      creator: { select: { emp_id: true, name: true, email: true } },
      approver: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });
  
  if (!loe) return res.status(404).json({ error: 'LOE not found' });
  res.json(enrichLoeWithCode(loe));
});


async function resolveLoeItems(loeItems, defaultBillingType = 'One-Time') {
  if (!Array.isArray(loeItems)) return [];

  const resolved = [];
  for (const item of loeItems) {
    let serviceId = Number(item.service_id);

    // If custom service name provided and no valid positive service_id
    if ((isNaN(serviceId) || !serviceId || item.is_custom || item.service_id === 'CUSTOM') && item.custom_service_name) {
      const deptId = parseInt(item.department_id) || 1;
      const srvName = String(item.custom_service_name).trim();

      // Check if service with same name & dept already exists
      let srv = await prisma.service.findFirst({
        where: {
          department_id: deptId,
          name: { equals: srvName, mode: 'insensitive' }
        }
      });

      if (!srv) {
        srv = await prisma.service.create({
          data: {
            department_id: deptId,
            name: srvName,
            sub_category: 'Client Specific',
            billing_type: defaultBillingType,
            price: Number(item.amount || 0),
            scope: item.custom_scope || null,
            is_active: true
          }
        });
      }
      serviceId = srv.service_id;
    }

    resolved.push({
      ...item,
      service_id: serviceId
    });
  }
  return resolved;
}

// POST /api/loes
exports.create = asyncHandler(async (req, res) => {
  clearLoeCache();
  const { company_id, created_by, type, billing_frequency, currency, start_date, end_date, loe_items } = req.body;
  const resolvedItems = await resolveLoeItems(loe_items, billing_frequency || type);
  const totalAmount = resolvedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const selectedCurrency = currency || 'LKR';

  const newLoe = await prisma.loe.create({
    data: {
      company_id: parseInt(company_id),
      created_by: parseInt(created_by),
      status: 'Approval Pending',
      type: type || 'Adhoc',
      billing_frequency: billing_frequency || 'One-Time',
      currency: selectedCurrency,
      start_date: new Date(start_date),
      end_date: end_date ? new Date(end_date) : undefined,
      loe_items: { 
        create: resolvedItems.map(item => ({
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
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  const enriched = enrichLoeWithCode(newLoe);

  const leaders = await getManagersAndAdmins();
  for (const leader of leaders) {
    sendLoeCreatedEmail(leader.email, leader.name, enriched.company.name, enriched.loe_id, totalAmount, selectedCurrency);
    await prisma.notification.create({
      data: {
        emp_id: leader.emp_id,
        title: 'New LOE Pending Approval',
        message: `${enriched.loe_code} for ${enriched.company.name} (${selectedCurrency} ${Number(totalAmount).toFixed(2)}) was created and requires review.`
      }
    });
  }
  
  res.status(201).json(enriched);
});

// PUT /api/loes/:id
exports.update = asyncHandler(async (req, res) => {
  clearLoeCache();
  const { company_id, type, billing_frequency, currency, start_date, end_date, loe_items } = req.body;
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) return res.status(400).json({ error: 'Invalid LOE ID format' });

  const data = {};
  if (company_id) data.company_id = parseInt(company_id);
  if (type) data.type = type;
  if (billing_frequency) data.billing_frequency = billing_frequency;
  if (currency) data.currency = currency;
  if (start_date) data.start_date = new Date(start_date);
  if (end_date !== undefined) data.end_date = end_date ? new Date(end_date) : null;

  let allApproved = false;
  if (Array.isArray(loe_items)) {
    const resolvedItems = await resolveLoeItems(loe_items, billing_frequency || type);
    const itemsToCreate = resolvedItems.map(item => {
      const isApproved = item.status === 'Approved';
      return {
        service_id: Number(item.service_id),
        custom_scope: item.custom_scope || null,
        amount: Number(item.amount || 0),
        status: isApproved ? 'Approved' : 'Pending',
        rejection_reason: null
      };
    });

    allApproved = itemsToCreate.length > 0 && itemsToCreate.every(i => i.status === 'Approved');
    data.status = allApproved ? 'Approved' : 'Approval Pending';
    if (!allApproved) data.approved_by = null;
    data.loe_items = { deleteMany: {}, create: itemsToCreate };
  }

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data,
    include: { 
      company: true, 
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  if (allApproved) await processApprovedLoe(loeId, updatedLoe.approved_by);
  res.json(enrichLoeWithCode(updatedLoe));
});

const deleteLoe = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) return res.status(400).json({ error: 'Invalid LOE ID format' });
  await prisma.loe.delete({ where: { loe_id: loeId } });
  res.json({ message: 'LOE deleted successfully' });
});

exports.remove = deleteLoe;
exports.delete = deleteLoe;

// GET /api/loes/pending
exports.getPending = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: { 
      company: true, 
      loe_items: { include: { service: { include: { department: true } } } } 
    },
    orderBy: { loe_id: 'desc' }
  };

  if (role === 'ADMIN') query.where = { status: 'Approval Pending' };
  else query.where = { status: 'Approval Pending', loe_items: { some: { service: { department_id: deptId }, status: 'Pending' } } };

  const loes = await prisma.loe.findMany(query);
  res.json(loes.map(enrichLoeWithCode));
});

exports.approveItem = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const { emp_id } = req.body;

  await prisma.loeItem.update({
    where: { loe_item_id: itemId },
    data: { status: 'Approved', rejection_reason: null }
  });

  const allItems = await prisma.loeItem.findMany({ where: { loe_id: loeId } });
  const allApproved = allItems.every(i => i.status === 'Approved');
  const hasRejected = allItems.some(i => i.status === 'Rejected');

  let newLoeStatus = 'Approval Pending';
  if (allApproved) newLoeStatus = 'Approved';
  else if (hasRejected) newLoeStatus = 'Rejected';

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: newLoeStatus, approved_by: allApproved ? parseInt(emp_id) : undefined },
    include: { 
      company: true, 
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  if (allApproved) await processApprovedLoe(loeId, emp_id);
  res.json(enrichLoeWithCode(updatedLoe));
});

exports.rejectItem = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  const itemId = parseInt(req.params.itemId);
  const { reason, emp_id } = req.body;

  await prisma.loeItem.update({
    where: { loe_item_id: itemId },
    data: { status: 'Rejected', rejection_reason: reason || 'Revision required' }
  });

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: 'Rejected' },
    include: { 
      company: true, 
      creator: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  await notifyManagersOfLoeRejection(updatedLoe, reason, emp_id);
  res.json(enrichLoeWithCode(updatedLoe));
});

exports.reject = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  const { reason, emp_id } = req.body;

  await prisma.loeItem.updateMany({
    where: { loe_id: loeId },
    data: { status: 'Rejected', rejection_reason: reason || 'Revision required' }
  });

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: 'Rejected' },
    include: { 
      company: true, 
      creator: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  await notifyManagersOfLoeRejection(updatedLoe, reason, emp_id);
  res.json(enrichLoeWithCode(updatedLoe));
});

exports.approveAll = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  const { emp_id } = req.body;

  await prisma.loeItem.updateMany({
    where: { loe_id: loeId },
    data: { status: 'Approved', rejection_reason: null }
  });

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: { status: 'Approved', approved_by: emp_id ? parseInt(emp_id) : undefined },
    include: { 
      company: true, 
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  await processApprovedLoe(loeId, emp_id);
  res.json(enrichLoeWithCode(updatedLoe));
});

// GET /api/loes/:id/pdf
exports.generatePdf = asyncHandler(async (req, res) => {
  const loeId = parseInt(req.params.id);
  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { 
      loe_items: { include: { service: { include: { department: true } } } } 
    }
  });

  if (!loe) return res.status(404).json({ error: 'LOE record not found' });
  const company = await prisma.company.findUnique({ where: { company_id: loe.company_id } });

  const enriched = enrichLoeWithCode({ ...loe, company });
  const pdfBuffer = await generateLoePdf({ loe: enriched, company });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${enriched.loe_code.replace(/\s+/g, '_')}.pdf`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});

// POST /api/loes/:id/send-to-client
exports.sendToClient = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) return res.status(400).json({ error: 'Invalid LOE ID format' });

  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: {
      company: true,
      creator: { select: { emp_id: true, name: true, email: true } },
      approver: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } }
    }
  });

  if (!loe) return res.status(404).json({ error: 'LOE record not found' });

  const targetEmail = loe.company?.primary_contact_email || loe.company?.email;
  if (!targetEmail || !targetEmail.trim()) {
    return res.status(400).json({
      error: `Cannot dispatch LOE: No email address found on file for ${loe.company?.name || 'client'}. Please update company contact email first.`
    });
  }

  const enriched = enrichLoeWithCode(loe);
  const totalAmount = (loe.loe_items || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const currency = loe.currency || 'LKR';

  // Dispatch email to client
  await sendLoeDispatchToClientEmail({
    toEmail: targetEmail.trim(),
    recipientName: loe.company?.primary_contact_name || loe.company?.name,
    companyName: loe.company?.name,
    loeId: loe.loe_id,
    loeCode: enriched.loe_code,
    totalAmount,
    currency
  });

  const now = new Date();
  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      is_dispatched: true,
      last_dispatched_at: now
    },
    include: {
      company: true,
      creator: { select: { emp_id: true, name: true, email: true } },
      approver: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } }
    }
  });

  res.json({
    message: `LOE ${enriched.loe_code} successfully dispatched to client at ${targetEmail}.`,
    loe: enrichLoeWithCode(updatedLoe),
    sent_at: now.toISOString()
  });
});

// POST /api/loes/:id/client-acceptance
exports.clientAcceptance = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) return res.status(400).json({ error: 'Invalid LOE ID format' });

  const { signatory_name, signatory_title, acceptance_date } = req.body;
  if (!signatory_name || !signatory_name.trim()) {
    return res.status(400).json({ error: 'Signatory full name is required for client acceptance.' });
  }

  const existing = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { company: true }
  });
  if (!existing) return res.status(404).json({ error: 'LOE record not found' });

  const acceptedDate = acceptance_date ? new Date(acceptance_date) : new Date();

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      is_client_accepted: true,
      client_signatory_name: signatory_name.trim(),
      client_signatory_title: (signatory_title || 'Authorized Signatory').trim(),
      client_accepted_at: acceptedDate
    },
    include: {
      company: true,
      creator: { select: { emp_id: true, name: true, email: true } },
      approver: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } }
    }
  });

  const enriched = enrichLoeWithCode(updatedLoe);

  // Notify leaders of client acceptance
  const leaders = await getManagersAndAdmins();
  for (const leader of leaders) {
    await prisma.notification.create({
      data: {
        emp_id: leader.emp_id,
        title: 'Client LOE Acceptance Confirmed',
        message: `${enriched.loe_code} for ${enriched.company?.name} has been officially approved and accepted by ${signatory_name.trim()}. Tasks can now be allocated.`
      }
    });
  }

  res.json({
    message: `Client acceptance officially recorded for ${enriched.loe_code}. Tasks can now be allocated.`,
    loe: enriched
  });
});

// PUT /api/loes/:id/discontinue
exports.discontinue = asyncHandler(async (req, res) => {
  clearLoeCache();
  const loeId = parseInt(req.params.id);
  if (isNaN(loeId)) return res.status(400).json({ error: 'Invalid LOE ID format' });

  const { reason, emp_id } = req.body;

  const existing = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { company: true }
  });
  if (!existing) return res.status(404).json({ error: 'LOE record not found' });

  const updatedLoe = await prisma.loe.update({
    where: { loe_id: loeId },
    data: {
      status: 'Discontinued'
    },
    include: {
      company: true,
      creator: { select: { emp_id: true, name: true, email: true } },
      approver: { select: { emp_id: true, name: true, email: true } },
      loe_items: { include: { service: { include: { department: true } } } }
    }
  });

  // Flag all uncompleted child tasks under related Job as Discontinued
  const job = await prisma.job.findUnique({ where: { loe_id: loeId } });
  if (job) {
    await prisma.task.updateMany({
      where: {
        job_id: job.job_id,
        status: { not: 'Completed' }
      },
      data: {
        status: 'Discontinued'
      }
    });

    await prisma.job.update({
      where: { job_id: job.job_id },
      data: { status: 'Discontinued' }
    });
  }

  const enriched = enrichLoeWithCode(updatedLoe);

  // Notify leaders
  const leaders = await getManagersAndAdmins();
  for (const leader of leaders) {
    await prisma.notification.create({
      data: {
        emp_id: leader.emp_id,
        title: 'Engagement Discontinued',
        message: `${enriched.loe_code} for ${enriched.company?.name} has been discontinued midway. Child tasks have been flagged as Discontinued.`
      }
    });
  }

  res.json({
    message: `LOE ${enriched.loe_code} has been marked as Discontinued.`,
    loe: enriched
  });
});
