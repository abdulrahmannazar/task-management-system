const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');

exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated.' });

    const token = jwt.sign(
        { emp_id: user.emp_id, role: user.role, department_id: user.department_id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.status(200).json({ token, role: user.role, emp_id: user.emp_id, name: user.name });
});