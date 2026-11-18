const invoiceCache = new Map();
const INVOICE_CACHE_TTL = 8000;
const clearInvoiceCache = () => invoiceCache.clear();
const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');
const { generateInvoicePdf } = require('../services/pdfService');
const { sendInvoiceReminderEmail, sendInvoiceDispatchToClientEmail } = require('../services/emailService');

// GET /api/invoices
exports.getAll = asyncHandler(async (req, res) => {
  const cacheKey = `${req.query.role}_${req.query.department_id}`;
  const cached = invoiceCache.get(cacheKey);
  if (cached && (Date.now() - cached.time < INVOICE_CACHE_TTL)) {
    return res.json(cached.data);
  }
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);

  const query = {
    include: {
      payments: {
        orderBy: { payment_id: 'desc' }
      },
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
  invoiceCache.set(cacheKey, { data: invoices, time: Date.now() });
  res.json(invoices);
});

// GET /api/invoices/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: {
      payments: {
        orderBy: { payment_id: 'desc' }
      },
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

// POST /api/invoices (Create Custom or Proforma Invoice)
exports.create = asyncHandler(async (req, res) => {
  clearInvoiceCache();
  const { job_id, total_amount, due_date, invoice_type = 'Standard', notes } = req.body;
  const numericJobId = parseInt(job_id);
  const amount = parseFloat(total_amount);

  if (isNaN(numericJobId)) {
    return res.status(400).json({ error: 'Valid Job ID is required' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Valid invoice amount is required' });
  }

  const job = await prisma.job.findUnique({
    where: { job_id: numericJobId },
    include: { loe: { include: { company: true } } }
  });
  if (!job) {
    return res.status(404).json({ error: 'Associated Job not found' });
  }

  const issuedDate = new Date();
  const dueDateObj = due_date ? new Date(due_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const newInvoice = await prisma.invoice.create({
    data: {
      job_id: numericJobId,
      total_amount: amount,
      status: 'Not Paid',
      issued_date: issuedDate,
      due_date: dueDateObj,
      invoice_type: invoice_type || 'Standard',
      paid_amount: 0,
      notes: notes || null
    },
    include: {
      job: {
        include: {
          loe: {
            include: {
              company: true,
              loe_items: { include: { service: { include: { department: true } } } }
            }
          }
        }
      },
      payments: true
    }
  });

  res.status(201).json(newInvoice);
});

// POST /api/invoices/:id/payments (Receive Full or Partial Payment)
exports.addPayment = asyncHandler(async (req, res) => {
  clearInvoiceCache();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const { amount, payment_date, payment_method = 'Bank Transfer', reference_no, notes } = req.body;
  const paymentAmt = parseFloat(amount);
  if (isNaN(paymentAmt) || paymentAmt <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero' });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: { payments: true }
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const currentPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const newTotalPaid = currentPaid + paymentAmt;
  const totalInvoiceAmt = Number(invoice.total_amount);

  let newStatus = 'Not Paid';
  if (newTotalPaid >= totalInvoiceAmt - 0.01) {
    newStatus = 'Paid';
  } else if (newTotalPaid > 0) {
    newStatus = 'Partially Paid';
  }

  const paymentRecord = await prisma.invoicePayment.create({
    data: {
      invoice_id: id,
      amount: paymentAmt,
      payment_date: payment_date ? new Date(payment_date) : new Date(),
      payment_method: payment_method || 'Bank Transfer',
      reference_no: reference_no || null,
      notes: notes || null
    }
  });

  const updatedInvoice = await prisma.invoice.update({
    where: { invoice_id: id },
    data: {
      paid_amount: newTotalPaid,
      status: newStatus
    },
    include: {
      job: {
        include: {
          loe: {
            include: {
              company: true,
              loe_items: { include: { service: { include: { department: true } } } }
            }
          }
        }
      },
      payments: { orderBy: { payment_id: 'desc' } }
    }
  });

  res.status(201).json({
    message: 'Payment recorded successfully',
    payment: paymentRecord,
    invoice: updatedInvoice
  });
});

// GET /api/invoices/:id/payments
exports.getPayments = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const payments = await prisma.invoicePayment.findMany({
    where: { invoice_id: id },
    orderBy: { payment_id: 'desc' }
  });
  res.json(payments);
});

// GET /api/invoices/reports (Clients Due, Department Due, Aging Report)
exports.getReports = asyncHandler(async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: {
      job: {
        include: {
          loe: {
            include: {
              company: true,
              loe_items: { include: { service: { include: { department: true } } } }
            }
          }
        }
      },
      payments: true
    },
    orderBy: { invoice_id: 'desc' }
  });

  const now = new Date();

  // 1. Clients Due Report
  const clientsMap = new Map();
  // 2. Department Due Report
  const deptMap = new Map();
  // 3. Aging Report Buckets
  const aging = {
    current: { count: 0, total_amount: 0, balance_due: 0, invoices: [] },
    days_31_60: { count: 0, total_amount: 0, balance_due: 0, invoices: [] },
    days_61_90: { count: 0, total_amount: 0, balance_due: 0, invoices: [] },
    days_90_plus: { count: 0, total_amount: 0, balance_due: 0, invoices: [] }
  };

  for (const inv of invoices) {
    const company = inv.job?.loe?.company;
    const compId = company?.company_id || 0;
    const compName = company?.name || 'Unknown Company';
    const totalAmt = Number(inv.total_amount || 0);
    const paidAmt = Number(inv.paid_amount || 0);
    const balance = Math.max(0, totalAmt - paidAmt);
    const isOverdue = inv.status !== 'Paid' && inv.due_date && new Date(inv.due_date) < now;

    // Client aggregation
    if (!clientsMap.has(compId)) {
      clientsMap.set(compId, {
        company_id: compId,
        company_name: compName,
        total_invoiced: 0,
        total_paid: 0,
        balance_due: 0,
        invoice_count: 0,
        overdue_count: 0
      });
    }
    const cStat = clientsMap.get(compId);
    cStat.total_invoiced += totalAmt;
    cStat.total_paid += paidAmt;
    cStat.balance_due += balance;
    cStat.invoice_count += 1;
    if (isOverdue) cStat.overdue_count += 1;

    // Department aggregation
    const loeItems = inv.job?.loe?.loe_items || [];
    const deptsSeen = new Set();
    loeItems.forEach((item) => {
      const d = item.service?.department;
      if (d && !deptsSeen.has(d.department_id)) {
        deptsSeen.add(d.department_id);
        if (!deptMap.has(d.department_id)) {
          deptMap.set(d.department_id, {
            department_id: d.department_id,
            department_name: d.name,
            total_invoiced: 0,
            total_paid: 0,
            balance_due: 0,
            invoice_count: 0
          });
        }
        const dStat = deptMap.get(d.department_id);
        dStat.total_invoiced += totalAmt;
        dStat.total_paid += paidAmt;
        dStat.balance_due += balance;
        dStat.invoice_count += 1;
      }
    });

    // Aging classification (only for unpaid / partially paid)
    if (inv.status !== 'Paid' && balance > 0) {
      const dueDate = new Date(inv.due_date || inv.issued_date);
      const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      let bucketKey = 'current';
      if (diffDays > 90) bucketKey = 'days_90_plus';
      else if (diffDays > 60) bucketKey = 'days_61_90';
      else if (diffDays > 30) bucketKey = 'days_31_60';

      aging[bucketKey].count += 1;
      aging[bucketKey].total_amount += totalAmt;
      aging[bucketKey].balance_due += balance;
      aging[bucketKey].invoices.push({
        invoice_id: inv.invoice_id,
        company_name: compName,
        issued_date: inv.issued_date,
        due_date: inv.due_date,
        diff_days: diffDays,
        total_amount: totalAmt,
        paid_amount: paidAmt,
        balance_due: balance,
        status: inv.status
      });
    }
  }

  res.json({
    clientsDue: Array.from(clientsMap.values()).sort((a, b) => b.balance_due - a.balance_due),
    departmentDue: Array.from(deptMap.values()).sort((a, b) => b.total_invoiced - a.total_invoiced),
    agingReport: aging
  });
});

// PUT /api/invoices/:id
exports.update = asyncHandler(async (req, res) => {
  clearInvoiceCache();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const { status, due_date, total_amount, paid_amount, notes, invoice_type } = req.body;
  const data = {};
  if (status !== undefined) data.status = status;
  if (due_date !== undefined) data.due_date = new Date(due_date);
  if (total_amount !== undefined) data.total_amount = Number(total_amount);
  if (paid_amount !== undefined) data.paid_amount = Number(paid_amount);
  if (notes !== undefined) data.notes = notes;
  if (invoice_type !== undefined) data.invoice_type = invoice_type;

  const updatedInvoice = await prisma.invoice.update({
    where: { invoice_id: id },
    data,
    include: {
      payments: {
        orderBy: { payment_id: 'desc' }
      },
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

// POST /api/invoices/:id/remind
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
  const currency = invoice.job.loe.currency || 'LKR';

  const leaders = await prisma.employee.findMany({
    where: { 
      role: { in: ['ADMIN', 'MANAGER'] }, 
      is_active: true 
    },
    select: { emp_id: true, name: true, email: true }
  });

  for (const leader of leaders) {
    sendInvoiceReminderEmail(
      leader.email, 
      leader.name, 
      company.name, 
      invoice.invoice_id, 
      invoice.total_amount, 
      invoice.due_date,
      currency
    );

    await prisma.notification.create({
      data: {
        emp_id: leader.emp_id,
        title: 'Unpaid Invoice Alert',
        message: `Notice for unpaid Invoice INV-${String(invoice.invoice_id).padStart(5, '0')} (${company.name}) for ${currency} ${Number(invoice.total_amount).toFixed(2)}.`
      }
    });
  }

  const updatedInvoice = await prisma.invoice.update({
    where: { invoice_id: id },
    data: { last_reminded_at: new Date() },
    include: { job: { include: { loe: { include: { company: true } } } } }
  });

  res.json({ 
    message: 'Reminder dispatched to managers and admins successfully', 
    invoice: updatedInvoice 
  });
});

// GET /api/invoices/:id/pdf
exports.generatePdf = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: id },
    include: {
      payments: {
        orderBy: { payment_id: 'desc' }
      },
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

  const customLogo = req.query.logo || null;
  const logoAlignment = req.query.align || 'center';

  const pdfBuffer = await generateInvoicePdf({
    invoice,
    loe: invoice.job.loe,
    company: invoice.job.loe.company,
    customLogo,
    logoAlignment
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoice_id}.pdf`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.end(pdfBuffer);
});

// DELETE /api/invoices/:id
const deleteInvoice = asyncHandler(async (req, res) => {
  clearInvoiceCache();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Invoice ID' });

  await prisma.invoice.delete({ where: { invoice_id: id } });
  res.json({ message: 'Invoice deleted successfully' });
});

// POST /api/invoices/:id/send-to-client
exports.sendToClient = asyncHandler(async (req, res) => {
  clearInvoiceCache();
  const invoiceId = parseInt(req.params.id);
  if (isNaN(invoiceId)) return res.status(400).json({ error: 'Invalid Invoice ID format' });

  const invoice = await prisma.invoice.findUnique({
    where: { invoice_id: invoiceId },
    include: {
      payments: { orderBy: { payment_id: 'desc' } },
      job: {
        include: {
          loe: {
            include: {
              company: true,
              creator: { select: { emp_id: true, name: true, email: true } }
            }
          }
        }
      }
    }
  });

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const company = invoice.job?.loe?.company;
  const targetEmail = company?.primary_contact_email || company?.email;
  if (!targetEmail || !targetEmail.trim()) {
    return res.status(400).json({
      error: `Cannot dispatch Invoice: No email address found on file for ${company?.name || 'client'}.`
    });
  }

  const { sender_email, sender_name } = req.body || {};
  const senderEmail = sender_email || req.user?.email || invoice.job?.loe?.creator?.email;
  const senderName = sender_name || req.user?.name || invoice.job?.loe?.creator?.name;

  const currency = invoice.job?.loe?.currency || 'LKR';
  const totalAmount = Number(invoice.total_amount || 0);

  if (typeof sendInvoiceDispatchToClientEmail === 'function') {
    await sendInvoiceDispatchToClientEmail({
      toEmail: targetEmail.trim(),
      recipientName: company?.primary_contact_name || company?.name,
      companyName: company?.name,
      invoiceId: invoice.invoice_id,
      amount: totalAmount,
      dueDate: invoice.due_date,
      currency,
      senderName,
      senderEmail
    });
  }

  const now = new Date();
  const invCode = `INV-${String(invoice.invoice_id).padStart(5, '0')}`;
  res.json({
    message: `Invoice ${invCode} successfully dispatched to ${targetEmail}${senderEmail ? ` from ${senderEmail}` : ''}.`,
    invoice,
    sent_at: now.toISOString()
  });
});

exports.remove = deleteInvoice;
exports.delete = deleteInvoice;
