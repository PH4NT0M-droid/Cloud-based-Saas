const express = require('express');
const rateController = require('../controllers/rateController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const { updateRateValidator, bulkUpdateRateValidator, getRatesValidator } = require('../validators/rateValidators');

const router = express.Router();

router.use(authenticate);

router.post('/update', authorizeRoles('ADMIN', 'MANAGER'), updateRateValidator, validateRequest, rateController.updateRate);
router.post(
  '/bulk-update',
  authorizeRoles('ADMIN', 'MANAGER'),
  bulkUpdateRateValidator,
  validateRequest,
  rateController.bulkUpdateRates,
);
router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), getRatesValidator, validateRequest, rateController.getRates);

module.exports = router;
