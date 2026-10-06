const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');
const { generateInvoicePdf } = require('../services/pdfService');
const { sendInvoiceReminderEmail } = require('../services/emailService');

const getEmpId = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your_jwt_secret');
      return decoded.emp_id;
    } catch {}
  }
  return null;
};

// GET /api/invoices
exports.getAll = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: {
      job: {
        include: {
          loe: {
            include: {
              company: true,
              creator: { select: { emp_id: true, name: true, email: true } },
              approver: { select: { emp_id: true, name: true, email: true } },
              loe_items: {
                include: {
                  service: {
                    include: { department: true }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { invoice_id: 'desc' }
  };

  if (role !== 'ADMIN' && !isNaN(deptId)) {
    query.where = {
      job: {
        loe: {
          loe_items: {
            some: {
              service: { department_id: deptId }
            }
          }
        }
      }
    };
  }

  const invoices = await prisma.invoice.findMany(query);
  res.json(invoices);
});

// GET /api/invoices/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: {
      job: {
        include: {
          loe: {
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
          }
        }
      }
    }
  });

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

// PUT /api/invoices/:id
exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const { status, due_date, total_amount } = req.body;
  const data = {};
  if (status !== undefined) data.status = status;
  if (due_date !== undefined) data.due_date = new Date(due_date);
  if (total_amount !== undefined) data.total_amount = Number(total_amount);

  const updatedInvoice = await prisma.invoice.update({
    where: { invoice_id: id },
    data,
    include: {
      job: {
        include: {
          loe: {
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
          }
        }
      }
    }
  });

  res.json(updatedInvoice);
});

// POST /api/invoices/:id/remind (Immediate notification + Async email)
exports.remind = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: { job: { include: { loe: { include: { company: true } }, manager: true } } }
  });

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'Paid') return res.status(400).json({ error: 'Invoice is already marked as Paid' });

  const company = invoice.job.loe.company;
  const currentEmpId = getEmpId(req);

  // 1. In-App Notifications written immediately
  const notifTargets = new Set();
  if (currentEmpId) notifTargets.add(currentEmpId);
  if (invoice.job.manager_id) notifTargets.add(invoice.job.manager_id);

  for (const empId of notifTargets) {
    await prisma.notification.create({
      data: {
        emp_id: empId,
        title: 'Invoice Reminder Dispatched',
        message: `Payment reminder sent to ${company.name} for Invoice INV-${String(invoice.invoice_id).padStart(5, '0')} ($${Number(invoice.total_amount).toFixed(2)}).`
      }
    });
  }

  // 2. Update DB timestamp
  const updatedInvoice = await prisma.invoice.update({
    where: { invoice_id: id },
    data: { last_reminded_at: new Date() },
    include: { job: { include: { loe: { include: { company: true } } } } }
  });

  // 3. Email sent in background (No await so response is fast)
  sendInvoiceReminderEmail(company.email, company.name, invoice.invoice_id, invoice.total_amount, invoice.due_date);

  res.json({ message: 'Reminder dispatched successfully', invoice: updatedInvoice });
});

// GET /api/invoices/:id/pdf
exports.generatePdf = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: {
      job: {
        include: {
          loe: {
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
          }
        }
      }
    }
  });

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const pdfBuffer = await generateInvoicePdf({
    invoice,
    loe: invoice.job.loe,
    company: invoice.job.loe.company
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoice_id}.pdf`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  await prisma.invoice.delete({ where: { invoice_id: id } });
  res.json({ message: 'Invoice deleted successfully' });
});

exports.remove = deleteInvoice;
exports.delete = deleteInvoice;