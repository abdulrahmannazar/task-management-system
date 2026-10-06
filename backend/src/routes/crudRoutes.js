const express = require('express');

const createCrudRouter = (controller) => {
  const router = express.Router();

  if (typeof controller.getPending === 'function') {
    router.get('/pending', controller.getPending);
  }

  if (typeof controller.generatePdf === 'function') {
    router.get('/:id/pdf', controller.generatePdf);
  }

  if (typeof controller.generateInvoicePdf === 'function') {
    router.get('/:id/invoice-pdf', controller.generateInvoicePdf);
    router.get('/:id/invoice/pdf', controller.generateInvoicePdf);
  }

  // NEW: Manual Reminder endpoints
  if (typeof controller.remind === 'function') {
    router.post('/:id/remind', controller.remind);
  }

  if (typeof controller.approveItem === 'function') {
    router.put('/:id/items/:itemId/approve', controller.approveItem);
  }
  if (typeof controller.rejectItem === 'function') {
    router.put('/:id/items/:itemId/reject', controller.rejectItem);
  }

  if (typeof controller.approveAll === 'function') {
    router.put('/:id/approve-all', controller.approveAll);
  }
  if (typeof controller.approve === 'function') {
    router.put('/:id/approve', controller.approve);
  }
  if (typeof controller.reject === 'function') {
    router.put('/:id/reject', controller.reject);
  }

  if (typeof controller.getAll === 'function') {
    router.get('/', controller.getAll);
  }
  if (typeof controller.create === 'function') {
    router.post('/', controller.create);
  }
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