const express = require('express');

const createCrudRouter = (controller) => {
  const router = express.Router();

  // Specific routes
  if (controller.getPending) {
    router.get('/pending', controller.getPending);
  }

  // Standard collection routes
  router.get('/', controller.getAll);
  router.post('/', controller.create);

  // PDF download route
  if (controller.generatePdf) {
    router.get('/:id/pdf', controller.generatePdf);
  }

  // Action routes
  if (controller.approve) {
    router.put('/:id/approve', controller.approve);
  }
  if (controller.reject) {
    router.put('/:id/reject', controller.reject);
  }

  // Parametric ID routes
  router.get('/:id', controller.getById);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove || controller.delete);

  return router;
};

module.exports = createCrudRouter;