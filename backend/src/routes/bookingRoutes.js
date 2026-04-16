const express = require('express');
const bookingController = require('../controllers/bookingController');
const { authenticate, authorizeRoles, authorizeManageBookings } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  bookingIdValidator,
  listBookingsValidator,
  updateBookingStatusValidator,
  createManualBookingValidator,
  updateBookingValidator,
  syncBookingsValidator,
} = require('../validators/bookingValidators');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF'),
  authorizeManageBookings,
  listBookingsValidator,
  validateRequest,
  bookingController.listBookings,
);
router.get(
  '/:id',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF'),
  authorizeManageBookings,
  bookingIdValidator,
  validateRequest,
  bookingController.getBookingById,
);
router.post(
  '/manual',
  authorizeRoles('ADMIN', 'MANAGER'),
  authorizeManageBookings,
  createManualBookingValidator,
  validateRequest,
  bookingController.createManualBooking,
);
router.post(
  '/',
  authorizeRoles('ADMIN', 'MANAGER'),
  authorizeManageBookings,
  createManualBookingValidator,
  validateRequest,
  bookingController.createManualBooking,
);
router.post(
  '/create',
  authorizeRoles('ADMIN', 'MANAGER'),
  authorizeManageBookings,
  createManualBookingValidator,
  validateRequest,
  bookingController.createManualBooking,
);
router.get(
  '/:id/invoice',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF'),
  authorizeManageBookings,
  bookingIdValidator,
  validateRequest,
  bookingController.getInvoice,
);
router.get(
  '/:id/invoice/preview',
  authorizeRoles('ADMIN', 'MANAGER', 'STAFF'),
  authorizeManageBookings,
  bookingIdValidator,
  validateRequest,
  bookingController.previewInvoice,
);
router.put(
  '/:id/status',
  authorizeRoles('ADMIN', 'MANAGER'),
  authorizeManageBookings,
  updateBookingStatusValidator,
  validateRequest,
  bookingController.updateBookingStatus,
);
router.put(
  '/:id',
  authorizeRoles('ADMIN', 'MANAGER'),
  authorizeManageBookings,
  updateBookingValidator,
  validateRequest,
  bookingController.updateBooking,
);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), authorizeManageBookings, bookingIdValidator, validateRequest, bookingController.deleteBooking);
router.post('/sync', authorizeRoles('ADMIN'), syncBookingsValidator, validateRequest, bookingController.syncBookings);

module.exports = router;
