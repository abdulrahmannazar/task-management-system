const express = require('express');

const buildRouter = (controller) => {
  const router = express.Router();

  // 1. SPECIFIC CUSTOM ROUTES (Must go first)
  if (controller.getPending) {
    router.get('/pending', controller.getPending);
  }
  
  if (controller.approve) {
    router.put('/:id/approve', controller.approve);
  }
  
  if (controller.reject) {
    router.put('/:id/reject', controller.reject);
  }

  // 2. STANDARD CRUD ROUTES (Wildcard /:id must go last)
  if (controller.getAll) router.get('/', controller.getAll);
  if (controller.getById) router.get('/:id', controller.getById);
  if (controller.create) router.post('/', controller.create);
  if (controller.update) router.put('/:id', controller.update);
  if (controller.remove) router.delete('/:id', controller.remove);

  return router;
};

module.exports = buildRouter;