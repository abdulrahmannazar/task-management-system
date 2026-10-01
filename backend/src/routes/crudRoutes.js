const express = require('express');

const createCrudRouter = (controller) => {
  const router = express.Router();

  // Workflow / Pending route
  if (typeof controller.getPending === 'function') {
    router.get('/pending', controller.getPending);
  }

  // PDF generation route
  if (typeof controller.generatePdf === 'function') {
    router.get('/:id/pdf', controller.generatePdf);
  }

  // Invoice PDF generation route
  if (typeof controller.generateInvoicePdf === 'function') {
    router.get('/:id/invoice-pdf', controller.generateInvoicePdf);
    router.get('/:id/invoice/pdf', controller.generateInvoicePdf);
  }

  // Item-level approval actions
  if (typeof controller.approveItem === 'function') {
    router.put('/:id/items/:itemId/approve', controller.approveItem);
  }
  if (typeof controller.rejectItem === 'function') {
    router.put('/:id/items/:itemId/reject', controller.rejectItem);
  }

  // Master approval actions
  if (typeof controller.approveAll === 'function') {
    router.put('/:id/approve-all', controller.approveAll);
  }
  if (typeof controller.approve === 'function') {
    router.put('/:id/approve', controller.approve);
  }
  if (typeof controller.reject === 'function') {
    router.put('/:id/reject', controller.reject);
  }

  // Standard collection routes
  if (typeof controller.getAll === 'function') {
    router.get('/', controller.getAll);
  }
  if (typeof controller.create === 'function') {
    router.post('/', controller.create);
  }

  // Parametric ID routes
  if (typeof controller.getById === 'function') {
    router.get('/:id', controller.getById);
  }
  if (typeof controller.update === 'function') {
    router.put('/:id', controller.update);
  }

  const deleteHandler = controller.remove || controller.delete;
  if (typeof deleteHandler === 'function') {
    router.delete('/:id', deleteHandler);
  }

  return router;
};

module.exports = createCrudRouter;