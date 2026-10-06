const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');
const { runAutomationSweep } = require('../services/cronService');
const { verifyAndSendTestEmail } = require('../services/emailService');

const getEmpId = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your_jwt_secret');
      return decoded.emp_id;
    } catch {}
  }
  return null;
};

// GET /api/notifications
exports.getMyNotifications = asyncHandler(async (req, res) => {
  const empId = getEmpId(req);
  if (!empId) return res.status(401).json({ error: 'Unauthorized' });

  const notifications = await prisma.notification.findMany({
    where: { emp_id: empId },
    orderBy: { created_at: 'desc' },
    take: 25
  });
  
  res.json(notifications);
});

// PUT /api/notifications/:id/read
exports.markAsRead = asyncHandler(async (req, res) => {
  const notificationId = parseInt(req.params.id);
  if (isNaN(notificationId)) return res.status(400).json({ error: 'Invalid ID' });

  await prisma.notification.update({
    where: { notification_id: notificationId },
    data: { is_read: true }
  });
  
  res.json({ success: true });
});

// PUT /api/notifications/read-all
exports.markAllAsRead = asyncHandler(async (req, res) => {
  const empId = getEmpId(req);
  if (!empId) return res.status(401).json({ error: 'Unauthorized' });

  await prisma.notification.updateMany({
    where: { emp_id: empId, is_read: false },
    data: { is_read: true }
  });

  res.json({ success: true });
});

// POST /api/notifications/trigger-cron
exports.triggerCron = asyncHandler(async (req, res) => {
  runAutomationSweep();
  res.json({ message: 'Automation sweep triggered successfully in background' });
});

// GET /api/notifications/test-email (Live browser diagnostic)
exports.testEmail = asyncHandler(async (req, res) => {
  const targetEmail = req.query.to || process.env.EMAIL_USER;
  try {
    const info = await verifyAndSendTestEmail(targetEmail);
    res.json({
      success: true,
      message: `Test email successfully delivered to ${targetEmail}`,
      sender: process.env.EMAIL_USER,
      messageId: info.messageId
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      senderConfigured: Boolean(process.env.EMAIL_USER),
      passwordConfigured: Boolean(process.env.EMAIL_PASS)
    });
  }
});