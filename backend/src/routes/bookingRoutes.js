const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  bookingIdValidator,
  listBookingsValidator,
  updateBookingStatusValidator,
  syncBookingsValidator,
} = require('../validators/bookingValidators');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), listBookingsValidator, validateRequest, bookingController.listBookings);
router.get('/:id', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), bookingIdValidator, validateRequest, bookingController.getBookingById);
router.put(
  '/:id/status',
  authorizeRoles('ADMIN', 'MANAGER'),
  updateBookingStatusValidator,
  validateRequest,
  bookingController.updateBookingStatus,
);
router.post('/sync', authorizeRoles('ADMIN'), syncBookingsValidator, validateRequest, bookingController.syncBookings);

module.exports = router;
