const prisma = require('../config/db');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');

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

exports.getMyNotifications = asyncHandler(async (req, res) => {
  const empId = getEmpId(req);
  if (!empId) return res.status(401).json({ error: 'Unauthorized' });

  const notifications = await prisma.notification.findMany({
    where: { emp_id: empId },
    orderBy: { created_at: 'desc' },
    take: 20
  });
  
  res.json(notifications);
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notificationId = parseInt(req.params.id);
  if (isNaN(notificationId)) return res.status(400).json({ error: 'Invalid ID' });

  await prisma.notification.update({
    where: { notification_id: notificationId },
    data: { is_read: true }
  });
  
  res.json({ success: true });
});