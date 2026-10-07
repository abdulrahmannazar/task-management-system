const cron = require('node-cron');
const prisma = require('../config/db');
const { 
  sendLoePendingReminderEmail,
  sendInvoiceCreatedEmail,
  sendInvoiceReminderEmail, 
  sendTaskReminderEmail 
} = require('./emailService');

async function getManagersAndAdmins() {
  return prisma.employee.findMany({
    where: { role: { in: ['ADMIN', 'MANAGER'] }, is_active: true },
    select: { emp_id: true, name: true, email: true }
  });
}

async function runAutomationSweep() {
  console.log('[Cron] Running automation sweep...');
  try {
    const today = new Date();
    const currentDay = new Date();
    currentDay.setHours(0, 0, 0, 0);

    const twentyFourHoursAgo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(currentDay.getTime() - 2 * 24 * 60 * 60 * 1000);

    // =========================================
    // 1. RECURRING INVOICES (Managers & Admins only)
    // =========================================
    const recurringLoes = await prisma.loe.findMany({
      where: {
        status: 'Approved',
        billing_frequency: { not: 'One-Time' },
        job: { isNot: null }
      },
      include: {
        job: { include: { invoices: { orderBy: { issued_date: 'desc' }, take: 1 } } },
        company: true,
        creator: true,
        loe_items: true
      }
    });

    for (const loe of recurringLoes) {
      if (loe.end_date && new Date(loe.end_date) < currentDay) continue;

      const latestInvoice = loe.job.invoices[0];
      if (!latestInvoice) continue;

      const lastIssueDate = new Date(latestInvoice.issued_date);
      let nextIssueDate = new Date(lastIssueDate);

      if (loe.billing_frequency === 'Monthly') nextIssueDate.setMonth(nextIssueDate.getMonth() + 1);
      else if (loe.billing_frequency === 'Quarterly') nextIssueDate.setMonth(nextIssueDate.getMonth() + 3);
      else if (loe.billing_frequency === 'Annually') nextIssueDate.setFullYear(nextIssueDate.getFullYear() + 1);

      if (nextIssueDate <= currentDay) {
        const totalAmount = loe.loe_items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const dueDate = new Date(currentDay);
        dueDate.setDate(dueDate.getDate() + 30);

        const newInvoice = await prisma.invoice.create({
          data: {
            job_id: loe.job.job_id,
            total_amount: totalAmount,
            status: 'Not Paid',
            issued_date: currentDay,
            due_date: dueDate
          }
        });

        // Notify Managers and Admins only (NO email to company)
        const leaders = await getManagersAndAdmins();
        for (const leader of leaders) {
          sendInvoiceCreatedEmail(leader.email, leader.name, loe.company.name, newInvoice.invoice_id, totalAmount, dueDate);
          await prisma.notification.create({
            data: {
              emp_id: leader.emp_id,
              title: 'Recurring Invoice Generated',
              message: `Recurring Invoice INV-${String(newInvoice.invoice_id).padStart(5, '0')} generated for ${loe.company.name}.`
            }
          });
        }
      }
    }

    // =========================================
    // 2. UNPAID INVOICE REMINDERS (Managers & Admins only)
    // =========================================
    const unpaidInvoices = await prisma.invoice.findMany({
      where: {
        status: 'Not Paid',
        OR: [
          { last_reminded_at: null },
          { last_reminded_at: { lte: twentyFourHoursAgo } }
        ]
      },
      include: { job: { include: { loe: { include: { company: true } } } } }
    });

    for (const inv of unpaidInvoices) {
      const company = inv.job.loe.company;

      const leaders = await getManagersAndAdmins();
      for (const leader of leaders) {
        sendInvoiceReminderEmail(leader.email, leader.name, company.name, inv.invoice_id, inv.total_amount, inv.due_date);
        await prisma.notification.create({
          data: {
            emp_id: leader.emp_id,
            title: 'Unpaid Invoice Alert',
            message: `Automated reminder: Invoice INV-${String(inv.invoice_id).padStart(5, '0')} for ${company.name} remains unpaid.`
          }
        });
      }

      await prisma.invoice.update({
        where: { invoice_id: inv.invoice_id },
        data: { last_reminded_at: today }
      });
    }

    // =========================================
    // 3. LOE PENDING APPROVAL REMINDERS (> 2 Days)
    // =========================================
    const pendingLoes = await prisma.loe.findMany({
      where: {
        status: 'Approval Pending',
        start_date: { lte: twoDaysAgo }
      },
      include: { company: true }
    });

    for (const loe of pendingLoes) {
      // Avoid sending duplicate alerts within a 24-hour window
      const alreadyReminded = await prisma.notification.findFirst({
        where: {
          title: 'LOE Pending Approval Reminder',
          message: { contains: `LOE-${String(loe.loe_id).padStart(5, '0')}` },
          created_at: { gte: twentyFourHoursAgo }
        }
      });

      if (alreadyReminded) continue;

      const leaders = await getManagersAndAdmins();
      for (const leader of leaders) {
        sendLoePendingReminderEmail(leader.email, leader.name, loe.company.name, loe.loe_id, 2);
        await prisma.notification.create({
          data: {
            emp_id: leader.emp_id,
            title: 'LOE Pending Approval Reminder',
            message: `LOE-${String(loe.loe_id).padStart(5, '0')} for ${loe.company.name} has been pending approval for more than 2 days.`
          }
        });
      }
    }

    // =========================================
    // 4. TASK DEADLINE REMINDERS (Employees)
    // =========================================
    const upcomingTasks = await prisma.task.findMany({
      where: {
        status: { not: 'Completed' },
        deadline: { not: null, lte: new Date(currentDay.getTime() + 2 * 24 * 60 * 60 * 1000) },
        OR: [
          { last_reminded_at: null },
          { last_reminded_at: { lte: twentyFourHoursAgo } }
        ]
      },
      include: { assignees: true }
    });

    for (const task of upcomingTasks) {
      for (const emp of task.assignees) {
        sendTaskReminderEmail(emp.email, emp.name, task.task_code, task.scope, task.deadline);
        await prisma.notification.create({
          data: {
            emp_id: emp.emp_id,
            title: 'Task Deadline Approaching',
            message: `Reminder: Task ${task.task_code} is due on ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}.`
          }
        });
      }

      await prisma.task.update({
        where: { task_id: task.task_id },
        data: { last_reminded_at: today }
      });
    }

    console.log('[Cron] Sweep completed successfully.');
  } catch (err) {
    console.error('[Cron Error] Failed during automation sweep:', err);
  }
}

cron.schedule('*/5 * * * *', runAutomationSweep);

module.exports = { runAutomationSweep };