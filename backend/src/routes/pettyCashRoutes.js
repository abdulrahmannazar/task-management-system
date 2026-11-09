const express = require('express');
const router = express.Router();
const pettyCashController = require('../controllers/pettyCashController');

// GET /api/petty-cash/allocated-tasks (must be above /:id to avoid param capture)
router.get('/allocated-tasks', pettyCashController.getAllocatedTasks);

// Standard CRUD endpoints
router.get('/', pettyCashController.getAll);
router.post('/', pettyCashController.create);
router.get('/:id', pettyCashController.getById);
router.delete('/:id', pettyCashController.remove);

// Lifecycle transition endpoints
router.put('/:id/approve', pettyCashController.approve);
router.put('/:id/reject', pettyCashController.reject);
router.put('/:id/disburse', pettyCashController.disburse);
router.put('/:id/settle', pettyCashController.settle);

module.exports = router;
