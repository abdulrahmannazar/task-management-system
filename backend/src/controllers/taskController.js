const prisma = require('../config/db');
const asyncHandler = require('../middlewares/asyncHandler');

// GET /api/tasks
exports.getAll = asyncHandler(async (req, res) => {
  const role = req.query.role;
  const deptId = parseInt(req.query.department_id);
  const empId = parseInt(req.query.emp_id);

  const query = {
    include: {
      service: {
        include: { department: true }
      },
      assignee: {
        select: { emp_id: true, name: true, email: true, department_id: true }
      },
      job: {
        include: {
          loe: {
            include: {
              company: true,
              creator: { select: { emp_id: true, name: true, email: true } },
              loe_items: {
                include: { service: true }
              }
            }
          }
        }
      }
    },
    orderBy: { task_id: 'desc' }
  };

  if (role === 'ADMIN') {
    // Admin sees all tasks across the company
  } else if (role === 'MANAGER' && !isNaN(deptId)) {
    // Manager sees all tasks belonging to their department's services
    query.where = {
      service: { department_id: deptId }
    };
  } else if (!isNaN(empId)) {
    // Regular employee sees tasks assigned to them
    query.where = {
      assigned_to: empId
    };
  }

  const tasks = await prisma.task.findMany(query);
  res.json(tasks);
});

// GET /api/tasks/:id
exports.getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Task ID' });

  const task = await prisma.task.findUnique({
    where: { task_id: id },
    include: {
      service: { include: { department: true } },
      assignee: { select: { emp_id: true, name: true, email: true } },
      job: {
        include: {
          loe: {
            include: { company: true, creator: true, loe_items: { include: { service: true } } }
          }
        }
      }
    }
  });

  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks
exports.create = asyncHandler(async (req, res) => {
  const { job_id, service_id, assigned_to, status, deadline, scope } = req.body;

  const task = await prisma.task.create({
    data: {
      job_id: parseInt(job_id),
      service_id: parseInt(service_id),
      assigned_to: assigned_to ? parseInt(assigned_to) : null,
      status: status || 'Pending',
      deadline: deadline ? new Date(deadline) : null,
      scope: scope || null
    },
    include: {
      service: { include: { department: true } },
      assignee: { select: { emp_id: true, name: true, email: true } },
      job: {
        include: {
          loe: { include: { company: true } }
        }
      }
    }
  });

  res.status(201).json(task);
});

// PUT /api/tasks/:id
exports.update = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid Task ID' });

  const { assigned_to, deadline, status, scope } = req.body;

  const data = {};
  if (assigned_to !== undefined) {
    data.assigned_to = assigned_to ? parseInt(assigned_to) : null;
  }
  if (deadline !== undefined) {
    data.deadline = deadline ? new Date(deadline) : null;
  }
  if (status !== undefined) {
    data.status = status;
  }
  if (scope !== undefined) {
    data.scope = scope;
  }

  const updatedTask = await prisma.task.update({
    where: { task_id: id },
    data,
    include: {
      service: { include: { department: true } },
      assignee: { select: { emp_id: true, name: true, email: true } },
      job: {
        include: {
          loe: { include: { company: true } }
        }
      }
    }
  });

  res.json(updatedTask);
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