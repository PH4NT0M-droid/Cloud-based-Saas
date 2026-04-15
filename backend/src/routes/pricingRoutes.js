const express = require('express');
const rateController = require('../controllers/rateController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const { updateRateValidator, bulkUpdateRateValidator, getRatesValidator } = require('../validators/rateValidators');

const router = express.Router();

router.use(authenticate);

router.post('/update', authorizeRoles('ADMIN', 'MANAGER'), updateRateValidator, validateRequest, rateController.updatePricing);
router.post(
  '/bulk-update',
  authorizeRoles('ADMIN', 'MANAGER'),
  bulkUpdateRateValidator,
  validateRequest,
  rateController.bulkUpdatePricing,
);
router.get('/grid', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), getRatesValidator, validateRequest, rateController.getPricingGrid);

module.exports = router;
