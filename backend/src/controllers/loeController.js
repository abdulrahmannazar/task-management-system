const { generateTaskCode } = require('../utils/taskCodeHelper');

/**
 * Automatically creates a Job, Tasks, and an Invoice with "Not Paid" status when an LOE is approved
 */
async function processApprovedLoe(loeId, managerEmpId) {
  const loe = await prisma.loe.findUnique({
    where: { loe_id: loeId },
    include: { 
      company: true,
      loe_items: { include: { service: true } } 
    }
  });
  if (!loe) return;

  // 1. Ensure Job record exists
  let job = await prisma.job.findUnique({
    where: { loe_id: loeId }
  });

  if (!job) {
    job = await prisma.job.create({
      data: {
        loe_id: loeId,
        manager_id: managerEmpId ? parseInt(managerEmpId) : loe.created_by,
        status: 'In-Progress'
      }
    });
  }

  // 2. Generate Tasks for services with custom Task IDs
  for (let i = 0; i < loe.loe_items.length; i++) {
    const item = loe.loe_items[i];
    const existingTask = await prisma.task.findFirst({
      where: {
        job_id: job.job_id,
        service_id: item.service_id,
        scope: item.custom_scope
      }
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

  // 3. Automatically create Invoice with status "Not Paid"
  const totalAmount = (loe.loe_items || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const existingInvoice = await prisma.invoice.findUnique({
    where: { job_id: job.job_id }
  });

  if (!existingInvoice) {
    const issuedDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(issuedDate.getDate() + 30);

    await prisma.invoice.create({
      data: {
        job_id: job.job_id,
        total_amount: totalAmount,
        status: 'Not Paid',
        issued_date: issuedDate,
        due_date: dueDate
      }
    });
  } else {
    await prisma.invoice.update({
      where: { invoice_id: existingInvoice.invoice_id },
      data: { total_amount: totalAmount }
    });
  }
}