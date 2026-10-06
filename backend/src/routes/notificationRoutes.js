const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/', notificationController.getMyNotifications);
router.get('/test-email', notificationController.testEmail);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.post('/trigger-cron', notificationController.triggerCron);

module.exports = router;