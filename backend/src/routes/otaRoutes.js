const express = require('express');
const otaController = require('../controllers/otaController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const { syncValidator, bookingsValidator } = require('../validators/otaValidators');

const router = express.Router();

router.use(authenticate);

router.post('/sync-inventory', authorizeRoles('ADMIN', 'MANAGER'), syncValidator, validateRequest, otaController.syncInventory);
router.post('/sync-rates', authorizeRoles('ADMIN', 'MANAGER'), syncValidator, validateRequest, otaController.syncRates);
router.get('/bookings', authorizeRoles('ADMIN'), bookingsValidator, validateRequest, otaController.fetchBookings);

module.exports = router;
