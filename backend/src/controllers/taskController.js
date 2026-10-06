const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');
const { generateTaskCode } = require('../utils/taskCodeHelper');

// GET /api/tasks
exports.getAll = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);
  const empId = parseInt(req.query.emp_id);

  const query = {
    include: {
      service: { include: { department: true } },
      assignees: { select: { emp_id: true, name: true, email: true, department_id: true } },
      job: {
        include: {
          loe: {
            include: {
              company: true,
              creator: { select: { emp_id: true, name: true, email: true } },
              loe_items: { include: { service: true } }
            }
          }
        }
      }
    },
    orderBy: { task_id: 'desc' }
  };

  if (role === 'ADMIN') {
    // Admins see all
  } else if (role === 'MANAGER' && !isNaN(deptId)) {
    query.where = { service: { department_id: deptId } };
  } else if (!isNaN(empId)) {
    query.where = { assignees: { some: { emp_id: empId } } };
  }

  const tasks = await prisma.task.findMany(query);

  // Dynamic fallback for any existing tasks that don't have task_code saved yet
  const enriched = tasks.map((t, idx) => {
    if (!t.task_code) {
      const companyName = t.job?.loe?.company?.name || 'CMP';
      return {
        ...t,
        task_code: generateTaskCode(companyName, t.scope || t.service?.name, t.task_id || idx + 1)
      };
    }
    return t;
  });

  res.json(enriched);
});

// GET /api/tasks/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Task ID' });

  const task = await prisma.task.findUnique({
    where: { task_id: id },
    include: {
      service: { include: { department: true } },
      assignees: { select: { emp_id: true, name: true, email: true } },
      job: { include: { loe: { include: { company: true } } } }
    }
  });

  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (!task.task_code) {
    task.task_code = generateTaskCode(
      task.job?.loe?.company?.name || 'CMP',
      task.scope || task.service?.name,
      task.task_id
    );
  }

  res.json(task);
});

// POST /api/tasks
exports.create = asyncHandler(async (req, res) => {
  const { job_id, loe_id, service_id, assignee_ids, status, deadline, duration_days, service_deadline, scope } = req.body;

  let targetJobId = job_id ? parseInt(job_id) : null;

  if (!targetJobId && loe_id) {
    const parsedLoeId = parseInt(loe_id);
    let job = await prisma.job.findUnique({ where: { loe_id: parsedLoeId } });

    if (!job) {
      const loe = await prisma.loe.findUnique({ where: { loe_id: parsedLoeId } });
      job = await prisma.job.create({
        data: {
          loe_id: parsedLoeId,
          manager_id: loe?.created_by || 1,
          status: 'In-Progress'
        }
      });
    }
    targetJobId = job.job_id;
  }

  if (!targetJobId || !service_id) {
    return res.status(400).json({ error: 'Valid LOE and Service selection required' });
  }

  // Determine Company Name and sequential task number for ID generation
  const jobWithCompany = await prisma.job.findUnique({
    where: { job_id: targetJobId },
    include: { loe: { include: { company: true } } }
  });
  const compName = jobWithCompany?.loe?.company?.name || 'CMP';
  const existingCount = await prisma.task.count({ where: { job_id: targetJobId } });
  const taskCode = generateTaskCode(compName, scope, existingCount + 1);

  const task = await prisma.task.create({
    data: {
      task_code: taskCode,
      job_id: targetJobId,
      service_id: parseInt(service_id),
      status: status || 'Pending',
      deadline: deadline ? new Date(deadline) : null,
      duration_days: duration_days ? parseInt(duration_days) : null,
      service_deadline: service_deadline ? new Date(service_deadline) : null,
      scope: scope || null,
      assignees: {
        connect: (assignee_ids || []).map(id => ({ emp_id: parseInt(id) }))
      }
    },
    include: {
      service: { include: { department: true } },
      assignees: { select: { emp_id: true, name: true, email: true, department_id: true } },
      job: { include: { loe: { include: { company: true } } } }
    }
  });

  res.status(201).json(task);
});



const { sendTaskReminderEmail, sendTaskCompletedEmail } = require('../services/emailService');

// PUT /api/tasks/:id
exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Task ID' });

  const { assignee_ids, deadline, duration_days, service_deadline, status, scope } = req.body;

  // Get previous task state to detect status changes
  const prevTask = await prisma.task.findUnique({
    where: { task_id: id },
    include: { assignees: true, job: { include: { manager: true } } }
  });

  const data = {};
  if (assignee_ids !== undefined) data.assignees = { set: assignee_ids.map(emp_id => ({ emp_id: parseInt(emp_id) })) };
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
  if (duration_days !== undefined) data.duration_days = duration_days ? parseInt(duration_days) : null;
  if (service_deadline !== undefined) data.service_deadline = service_deadline ? new Date(service_deadline) : null;
  if (status !== undefined) data.status = status;
  if (scope !== undefined) data.scope = scope;

  const updatedTask = await prisma.task.update({
    where: { task_id: id },
    data,
    include: {
      service: { include: { department: true } },
      assignees: { select: { emp_id: true, name: true, email: true } },
      job: { include: { manager: true, loe: { include: { company: true } } } }
    }
  });

  // Completion Logic: If status changed to 'Completed', trigger emails and notifications
  if (status === 'Completed' && prevTask && prevTask.status !== 'Completed') {
    // Notify Assignees
    for (const emp of updatedTask.assignees) {
      await sendTaskCompletedEmail(emp.email, emp.name, updatedTask.task_code, updatedTask.scope, false);
      await prisma.notification.create({
        data: {
          emp_id: emp.emp_id,
          title: 'Task Completed',
          message: `Your task ${updatedTask.task_code} has been successfully logged as completed.`
        }
      });
    }
    // Notify Manager
    if (updatedTask.job?.manager) {
      const manager = updatedTask.job.manager;
      await sendTaskCompletedEmail(manager.email, manager.name, updatedTask.task_code, updatedTask.scope, true);
      await prisma.notification.create({
        data: {
          emp_id: manager.emp_id,
          title: 'Team Task Completed',
          message: `The team has marked task ${updatedTask.task_code} as Completed. Ready for review.`
        }
      });
    }
  }

  res.json(updatedTask);
});

// POST /api/tasks/:id/remind
exports.remind = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Task ID' });

  const task = await prisma.task.findUnique({
    where: { task_id: id },
    include: { assignees: true }
  });

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.status === 'Completed') return res.status(400).json({ error: 'Cannot remind for a completed task' });

  for (const emp of task.assignees) {
    await sendTaskReminderEmail(emp.email, emp.name, task.task_code, task.scope, task.deadline);
    
    await prisma.notification.create({
      data: {
        emp_id: emp.emp_id,
        title: 'Manual Task Reminder',
        message: `Your manager requested an update on Task ${task.task_code}. Due date: ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}.`
      }
    });
  }

  const updatedTask = await prisma.task.update({
    where: { task_id: id },
    data: { last_reminded_at: new Date() }
  });

  res.json({ message: 'Reminders dispatched to assigned staff successfully', task: updatedTask });
});



// DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Task ID' });

  await prisma.task.delete({ where: { task_id: id } });
  res.json({ message: 'Task deleted successfully' });
});

exports.remove = deleteTask;
exports.delete = deleteTask;