const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');

router.get('/', permissionController.getPermissions);
router.put('/', permissionController.updatePermissions);

module.exports = router;