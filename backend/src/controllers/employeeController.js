const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const asyncHandler = require('../middlewares/asyncHandler');

exports.create = asyncHandler(async (req, res) => {
    const { department_id, manager_id, name, email, password, role } = req.body;

    // RBAC: Manager Scope Validation
    if (req.user.role === 'MANAGER') {
        if (department_id !== req.user.department_id) {
            return res.status(403).json({ error: "Managers can only add employees to their own department." });
        }
        if (role === 'ADMIN') {
            return res.status(403).json({ error: "Managers cannot create ADMIN accounts." });
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const employee = await prisma.employee.create({
        data: {
            department_id, manager_id, name, email, 
            role: role || 'EMPLOYEE', 
            password: hashedPassword
        }
    });

    delete employee.password;
    res.status(201).json(employee);
});

exports.getAll = asyncHandler(async (req, res) => {
    const query = {};
    
    // RBAC: Managers and Employees only see staff in their own department
    if (req.user.role === 'MANAGER' || req.user.role === 'EMPLOYEE') {
        query.department_id = req.user.department_id;
    }

    const employees = await prisma.employee.findMany({ 
        where: query,
        select: { emp_id: true, name: true, email: true, role: true, is_active: true, department: true } 
    });
    res.status(200).json(employees);
});

exports.getById = asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUniqueOrThrow({ 
        where: { emp_id: parseInt(req.params.id) },
        select: { emp_id: true, name: true, email: true, role: true, department_id: true, is_active: true }
    });

    // RBAC: Prevent viewing users outside of department unless Admin
    if (req.user.role !== 'ADMIN' && employee.department_id !== req.user.department_id) {
        return res.status(403).json({ error: "Access forbidden." });
    }

    res.status(200).json(employee);
});

exports.update = asyncHandler(async (req, res) => {
    const employee = await prisma.employee.update({ 
        where: { emp_id: parseInt(req.params.id) }, 
        data: req.body 
    });
    res.status(200).json(employee);
});

exports.remove = asyncHandler(async (req, res) => {
    await prisma.employee.delete({ where: { emp_id: parseInt(req.params.id) } });
    res.status(204).send(); 
});