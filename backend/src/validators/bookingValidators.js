const { body, param, query } = require('express-validator');

const bookingIdValidator = [param('id').isUUID().withMessage('Booking id must be a valid UUID')];

const listBookingsValidator = [
  query('otaSource').optional().isString().trim().isLength({ min: 2, max: 50 }).withMessage('Invalid otaSource'),
  query('roomTypeId').optional().isUUID().withMessage('roomTypeId must be a valid UUID'),
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
  query('endDate')
    .optional()
    .custom((value, { req }) => {
      if (!req.query.startDate) {
        return true;
      }
      return new Date(value) >= new Date(req.query.startDate);
    })
    .withMessage('endDate must be on or after startDate'),
];

const updateBookingStatusValidator = [
  ...bookingIdValidator,
  body('status').isIn(['CONFIRMED', 'CANCELLED']).withMessage('status must be CONFIRMED or CANCELLED'),
];

const createManualBookingValidator = [
  body('roomTypeId')
    .optional()
    .isUUID()
    .withMessage('roomTypeId must be a valid UUID'),
  body('room_id')
    .optional()
    .isUUID()
    .withMessage('room_id must be a valid UUID'),
  body().custom((value) => {
    if (!value.roomTypeId && !value.room_id) {
      throw new Error('roomTypeId or room_id is required');
    }
    return true;
  }),
  body('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
  body('start_date').optional().isISO8601().withMessage('start_date must be a valid ISO date'),
  body('end_date').optional().isISO8601().withMessage('end_date must be a valid ISO date'),
  body().custom((value) => {
    const startValue = value.startDate || value.start_date;
    const endValue = value.endDate || value.end_date;
    if (!startValue || !endValue) {
      throw new Error('startDate/start_date and endDate/end_date are required');
    }
    if (new Date(endValue) <= new Date(startValue)) {
      throw new Error('end date must be after start date');
    }
    return true;
  }),
  body('guestName')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('guestName must be 2-120 characters'),
  body('guest_name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('guest_name must be 2-120 characters'),
  body().custom((value) => {
    if (!value.guestName && !value.guest_name) {
      throw new Error('guestName or guest_name is required');
    }
    return true;
  }),
  body('guestsCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('guestsCount must be an integer greater than or equal to 1'),
  body('guests_count')
    .optional()
    .isInt({ min: 1 })
    .withMessage('guests_count must be an integer greater than or equal to 1'),
];

const syncBookingsValidator = [
  body('otas')
    .optional()
    .isArray()
    .withMessage('otas must be an array')
    .custom((otas) => {
      const supported = ['booking', 'airbnb', 'makemytrip', 'agoda'];
      const invalid = otas.filter((ota) => !supported.includes(ota));
      if (invalid.length > 0) {
        throw new Error(`Unsupported OTA(s): ${invalid.join(', ')}`);
      }
      return true;
    }),
];

module.exports = {
  bookingIdValidator,
  listBookingsValidator,
  updateBookingStatusValidator,
  createManualBookingValidator,
  syncBookingsValidator,
};
