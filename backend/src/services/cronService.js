const cron = require('node-cron');
const prisma = require('../config/db');
const { 
  sendInvoiceEmail, 
  sendInvoiceReminderEmail, 
  sendTaskReminderEmail 
} = require('./emailService');

// Runs daily at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Running daily automation sweep...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // =========================================
    // 1. GENERATE RECURRING INVOICES
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
      if (loe.end_date && new Date(loe.end_date) < today) continue;

      const latestInvoice = loe.job.invoices[0];
      if (!latestInvoice) continue;

      const lastIssueDate = new Date(latestInvoice.issued_date);
      let nextIssueDate = new Date(lastIssueDate);

      if (loe.billing_frequency === 'Monthly') nextIssueDate.setMonth(nextIssueDate.getMonth() + 1);
      else if (loe.billing_frequency === 'Quarterly') nextIssueDate.setMonth(nextIssueDate.getMonth() + 3);
      else if (loe.billing_frequency === 'Annually') nextIssueDate.setFullYear(nextIssueDate.getFullYear() + 1);

      if (nextIssueDate <= today) {
        const totalAmount = loe.loe_items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 30);

        const newInvoice = await prisma.invoice.create({
          data: {
            job_id: loe.job.job_id,
            total_amount: totalAmount,
            status: 'Not Paid',
            issued_date: today,
            due_date: dueDate
          }
        });

        await prisma.notification.create({
          data: {
            emp_id: loe.created_by,
            title: 'Recurring Invoice Generated',
            message: `Invoice INV-${String(newInvoice.invoice_id).padStart(5, '0')} for ${loe.company.name} generated.`
          }
        });

        await sendInvoiceEmail(loe.company.email || loe.creator.email, loe.company.name, newInvoice.invoice_id, totalAmount);
      }
    }

    // =========================================
    // 2. AUTOMATIC OVERDUE INVOICE REMINDERS
    // =========================================
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'Not Paid',
        due_date: { lt: today },
        OR: [
          { last_reminded_at: null },
          { last_reminded_at: { lte: threeDaysAgo } } // Remind every 3 days
        ]
      },
      include: { job: { include: { manager: true, loe: { include: { company: true } } } } }
    });

    for (const inv of overdueInvoices) {
      const company = inv.job.loe.company;
      
      await sendInvoiceReminderEmail(company.email, company.name, inv.invoice_id, inv.total_amount, inv.due_date);
      
      await prisma.notification.create({
        data: {
          emp_id: inv.job.manager_id,
          title: 'Unpaid Invoice Alert',
          message: `Automated reminder sent to ${company.name} for overdue Invoice INV-${String(inv.invoice_id).padStart(5, '0')}.`
        }
      });

      await prisma.invoice.update({
        where: { invoice_id: inv.invoice_id },
        data: { last_reminded_at: new Date() }
      });
    }

    // =========================================
    // 3. AUTOMATIC TASK DEADLINE REMINDERS
    // =========================================
    const twoDaysFromNow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

    const upcomingTasks = await prisma.task.findMany({
      where: {
        status: { not: 'Completed' },
        deadline: { not: null, lte: twoDaysFromNow },
        OR: [
          { last_reminded_at: null },
          { last_reminded_at: { lte: twoDaysAgo } } // Remind every 2 days
        ]
      },
      include: { assignees: true }
    });

    for (const task of upcomingTasks) {
      for (const emp of task.assignees) {
        await sendTaskReminderEmail(emp.email, emp.name, task.task_code, task.scope, task.deadline);
        
        await prisma.notification.create({
          data: {
            emp_id: emp.emp_id,
            title: 'Task Deadline Approaching',
            message: `Reminder: Task ${task.task_code} is due on ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}. Please update its status.`
          }
        });
      }

      await prisma.task.update({
        where: { task_id: task.task_id },
        data: { last_reminded_at: new Date() }
      });
    }

  } catch (err) {
    console.error('[Cron] Error in daily automation:', err);
  }
});