const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public endpoints for the frontend Registration & Login
router.post('/register', authController.register);
router.post('/login', authController.login);

// Public endpoint to feed the frontend dropdown (with high-performance in-memory caching)
router.get('/departments', authController.getDepartments);

module.exports = router;
