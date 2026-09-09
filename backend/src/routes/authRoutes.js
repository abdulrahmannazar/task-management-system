const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const prisma = require('../config/db'); // Add this import

// Public endpoints for the frontend Registration page
router.post('/register', authController.register);
router.post('/login', authController.login);

// New public endpoint to feed the frontend dropdown
router.get('/departments', async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            select: { department_id: true, name: true }
        });
        res.status(200).json(departments);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch departments" });
    }
});

module.exports = router;