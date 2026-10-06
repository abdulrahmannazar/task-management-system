const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');
const { generateInvoicePdf } = require('../services/pdfService');

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

  // Managers only view invoices that contain services for their department
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

// PUT /api/invoices/:id (Update status: "Not Paid" -> "Paid")
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

// ... existing code in invoiceController.js (leave getAll, getById, update, generatePdf as they are)

// POST /api/invoices/:id/remind
const { sendInvoiceReminderEmail } = require('../services/emailService');

exports.remind = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: { job: { include: { loe: { include: { company: true } }, manager: true } } }
  });

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'Paid') return res.status(400).json({ error: 'Invoice is already paid' });

  const company = invoice.job.loe.company;

  // Send manual email
  await sendInvoiceReminderEmail(company.email, company.name, invoice.invoice_id, invoice.total_amount, invoice.due_date);

  // Notify manager that they sent a reminder
  await prisma.notification.create({
    data: {
      emp_id: invoice.job.manager_id,
      title: 'Manual Invoice Reminder Sent',
      message: `You successfully sent a payment reminder to ${company.name} for INV-${String(invoice.invoice_id).padStart(5, '0')}.`
    }
  });

  // Update DB tracker
  const updatedInvoice = await prisma.invoice.update({
    where: { invoice_id: id },
    data: { last_reminded_at: new Date() },
    include: { job: { include: { loe: { include: { company: true } } } } }
  });

  res.json({ message: 'Reminder sent successfully', invoice: updatedInvoice });
});

exports.remove = deleteInvoice;
exports.delete = deleteInvoice;