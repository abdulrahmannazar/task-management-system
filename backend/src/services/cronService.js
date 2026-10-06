const cron = require('node-cron');
const prisma = require('../config/db');
const { sendInvoiceEmail } = require('./emailService');

// Schedule to run every day at Midnight ('0 0 * * *')
// For immediate testing, you can change this to '* * * * *' (every minute)
cron.schedule('0 0 * * *', async () => {
  console.log('[Cron] Running daily recurring invoice check...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all Approved LOEs that are NOT One-Time
    const recurringLoes = await prisma.loe.findMany({
      where: {
        status: 'Approved',
        billing_frequency: { not: 'One-Time' },
        job: { isNot: null }
      },
      include: {
        job: { 
          include: { 
            invoices: { orderBy: { issued_date: 'desc' }, take: 1 } 
          } 
        },
        company: true,
        creator: true,
        loe_items: true
      }
    });

    for (const loe of recurringLoes) {
      // 1. Check if the contract has hit its global end date
      if (loe.end_date && new Date(loe.end_date) < today) continue;

      // 2. Fetch the most recent invoice to calculate elapsed time
      const latestInvoice = loe.job.invoices[0];
      if (!latestInvoice) continue;

      const lastIssueDate = new Date(latestInvoice.issued_date);
      let nextIssueDate = new Date(lastIssueDate);

      // Add frequency interval
      if (loe.billing_frequency === 'Monthly') nextIssueDate.setMonth(nextIssueDate.getMonth() + 1);
      else if (loe.billing_frequency === 'Quarterly') nextIssueDate.setMonth(nextIssueDate.getMonth() + 3);
      else if (loe.billing_frequency === 'Annually') nextIssueDate.setFullYear(nextIssueDate.getFullYear() + 1);

      // 3. If today is the day (or past the day), generate the new invoice
      if (nextIssueDate <= today) {
        const totalAmount = loe.loe_items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        
        const dueDate = new Date(today);
        dueDate.setDate(dueDate.getDate() + 30); // 30 Day payment term

        const newInvoice = await prisma.invoice.create({
          data: {
            job_id: loe.job.job_id,
            total_amount: totalAmount,
            status: 'Not Paid',
            issued_date: today,
            due_date: dueDate
          }
        });

        // 4. Create In-App Notification for the Manager
        await prisma.notification.create({
          data: {
            emp_id: loe.created_by,
            title: 'Recurring Invoice Generated',
            message: `A new recurring invoice (INV-${String(newInvoice.invoice_id).padStart(5, '0')}) for ${loe.company.name} was automatically generated.`
          }
        });

        // 5. Send automated Email
        await sendInvoiceEmail(
          loe.company.email || loe.creator.email, 
          loe.company.name, 
          newInvoice.invoice_id, 
          totalAmount
        );

        console.log(`[Cron] Generated recurring invoice for LOE #${loe.loe_id}`);
      }
    }
  } catch (err) {
    console.error('[Cron] Error in recurring invoice job:', err);
  }
});