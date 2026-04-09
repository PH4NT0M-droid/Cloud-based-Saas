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
  syncBookingsValidator,
};
