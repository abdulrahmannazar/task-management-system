const express = require('express');

const createCrudRouter = (controller) => {
  const router = express.Router();

  if (controller.getPending) {
    router.get('/pending', controller.getPending);
  }

  router.get('/', controller.getAll);
  router.post('/', controller.create);

  if (controller.generatePdf) {
    router.get('/:id/pdf', controller.generatePdf);
  }

  // Item-level approval actions
  if (controller.approveItem) {
    router.put('/:id/items/:itemId/approve', controller.approveItem);
  }
  if (controller.rejectItem) {
    router.put('/:id/items/:itemId/reject', controller.rejectItem);
  }

  // Master approval actions
  if (controller.approveAll) {
    router.put('/:id/approve-all', controller.approveAll);
  }
  if (controller.approve) {
    router.put('/:id/approve', controller.approve);
  }
  if (controller.reject) {
    router.put('/:id/reject', controller.reject);
  }

  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove || controller.delete);

  return router;
};

module.exports = createCrudRouter;