const express = require('express');
const { authenticate, requireRole } = require('../middlewares/authMiddleware');

const buildRouter = (controller) => {
    const router = express.Router();
    
    // Require valid login for ALL routes
    router.use(authenticate);

    // Read Operations (Open to all logged-in users, data filtered in controllers)
    router.get('/', controller.getAll);
    router.get('/:id', controller.getById);
    
    // Write Operations (Locked to ADMIN and MANAGER only)
    const writeAccess = requireRole(['ADMIN', 'MANAGER']);
    router.post('/', writeAccess, controller.create);
    router.put('/:id', writeAccess, controller.update);
    router.delete('/:id', writeAccess, controller.remove);
    
    return router;
};

module.exports = buildRouter;