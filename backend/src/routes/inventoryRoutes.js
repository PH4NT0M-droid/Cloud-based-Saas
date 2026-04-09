const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  updateInventoryValidator,
  bulkUpdateInventoryValidator,
  getInventoryCalendarValidator,
} = require('../validators/inventoryValidators');

const router = express.Router();

router.use(authenticate);

router.post('/update', authorizeRoles('ADMIN', 'MANAGER'), updateInventoryValidator, validateRequest, inventoryController.updateInventory);

router.post(
  '/bulk-update',
  authorizeRoles('ADMIN', 'MANAGER'),
  bulkUpdateInventoryValidator,
  validateRequest,
  inventoryController.bulkUpdateInventory,
);

router.get(
  '/calendar',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF'),
  getInventoryCalendarValidator,
  validateRequest,
  inventoryController.getInventoryCalendar,
);

module.exports = router;
