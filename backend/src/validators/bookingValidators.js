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

const bookingRoomFieldsValidator = [
  body('rooms').optional().isArray({ min: 1 }).withMessage('rooms must be a non-empty array'),
  body('rooms.*.roomTypeId').optional().isUUID().withMessage('rooms.roomTypeId must be a valid UUID'),
  body('rooms.*.ratePlanId').optional({ nullable: true, checkFalsy: true }).isUUID().withMessage('rooms.ratePlanId must be a valid UUID'),
  body('rooms.*.rooms').optional().isInt({ min: 1 }).withMessage('rooms.rooms must be at least 1'),
  body('rooms.*.adults').optional().isInt({ min: 0 }).withMessage('rooms.adults cannot be negative'),
  body('rooms.*.extraBed').optional().isInt({ min: 0 }).withMessage('rooms.extraBed cannot be negative'),
  body('rooms.*.children').optional().isInt({ min: 0 }).withMessage('rooms.children cannot be negative'),
  body('rooms.*.pricePerNight').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }).withMessage('rooms.pricePerNight must be >= 0'),
];

const bookingPayloadValidator = [
  body('propertyId').optional().isUUID().withMessage('propertyId must be a valid UUID'),
  body('property_id').optional().isUUID().withMessage('property_id must be a valid UUID'),
  body('guestName').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('guestName must be 2-120 characters'),
  body('guest_name').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('guest_name must be 2-120 characters'),
  body('guestMobile').optional().isString().trim().isLength({ min: 7, max: 20 }).withMessage('guestMobile must be 7-20 characters'),
  body('guest_mobile').optional().isString().trim().isLength({ min: 7, max: 20 }).withMessage('guest_mobile must be 7-20 characters'),
  body('guestEmail').optional().isEmail().withMessage('guestEmail must be valid').normalizeEmail(),
  body('guest_email').optional().isEmail().withMessage('guest_email must be valid').normalizeEmail(),
  body('gstNumber').optional().isString().trim().isLength({ min: 5, max: 30 }).withMessage('gstNumber is invalid'),
  body('gst_number').optional().isString().trim().isLength({ min: 5, max: 30 }).withMessage('gst_number is invalid'),
  body('guestAddress').optional().isString().trim().isLength({ max: 500 }).withMessage('guestAddress is too long'),
  body('guest_address').optional().isString().trim().isLength({ max: 500 }).withMessage('guest_address is too long'),
  body('guestPincode').optional().isString().trim().matches(/^[0-9]{6}$/).withMessage('guestPincode must be exactly 6 digits'),
  body('guest_pincode').optional().isString().trim().matches(/^[0-9]{6}$/).withMessage('guest_pincode must be exactly 6 digits'),
  body('guestState').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('guestState is invalid'),
  body('guest_state').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('guest_state is invalid'),
  body('includeGstInvoice').optional().isBoolean().withMessage('includeGstInvoice must be a boolean'),
  body('include_gst_invoice').optional().isBoolean().withMessage('include_gst_invoice must be a boolean'),
  body('paidAmount').optional().isFloat({ min: 0 }).withMessage('paidAmount must be >= 0'),
  body('paid_amount').optional().isFloat({ min: 0 }).withMessage('paid_amount must be >= 0'),
  body('paymentReference').optional().isString().trim().isLength({ max: 120 }).withMessage('paymentReference is too long'),
  body('payment_reference').optional().isString().trim().isLength({ max: 120 }).withMessage('payment_reference is too long'),
  body('specialNote').optional().isString().trim().isLength({ max: 1000 }).withMessage('specialNote is too long'),
  body('special_note').optional().isString().trim().isLength({ max: 1000 }).withMessage('special_note is too long'),
  body('checkInDate').optional().isISO8601().withMessage('checkInDate must be a valid ISO date'),
  body('check_in_date').optional().isISO8601().withMessage('check_in_date must be a valid ISO date'),
  body('checkOutDate').optional().isISO8601().withMessage('checkOutDate must be a valid ISO date'),
  body('check_out_date').optional().isISO8601().withMessage('check_out_date must be a valid ISO date'),
  body('checkIn').optional().isISO8601().withMessage('checkIn must be a valid ISO date'),
  body('checkOut').optional().isISO8601().withMessage('checkOut must be a valid ISO date'),
  body('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
  body('start_date').optional().isISO8601().withMessage('start_date must be a valid ISO date'),
  body('end_date').optional().isISO8601().withMessage('end_date must be a valid ISO date'),
  body('roomTypeId').optional().isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('room_id').optional().isUUID().withMessage('room_id must be a valid UUID'),
  body('ratePlanId').optional().isUUID().withMessage('ratePlanId must be a valid UUID'),
  body('rate_plan_id').optional().isUUID().withMessage('rate_plan_id must be a valid UUID'),
  body('roomsCount').optional().isInt({ min: 1 }).withMessage('roomsCount must be at least 1'),
  body('rooms_count').optional().isInt({ min: 1 }).withMessage('rooms_count must be at least 1'),
  body('pricePerNight').optional().isFloat({ min: 0 }).withMessage('pricePerNight must be >= 0'),
  body('price_per_night').optional().isFloat({ min: 0 }).withMessage('price_per_night must be >= 0'),
  ...bookingRoomFieldsValidator,
  body().custom((value) => {
    const legacySingleRoomPayload = !Array.isArray(value.rooms) || value.rooms.length === 0;
    const strictBookingPayload = Array.isArray(value.rooms) && value.rooms.length > 0;

    if (!value.guestName && !value.guest_name) {
      throw new Error('guestName is required');
    }

    if (strictBookingPayload && !value.guestMobile && !value.guest_mobile) {
      throw new Error('guestMobile is required');
    }

    if (strictBookingPayload && !value.propertyId && !value.property_id) {
      throw new Error('propertyId is required');
    }

    const startValue = value.checkInDate || value.check_in_date || value.checkIn || value.startDate || value.start_date;
    const endValue = value.checkOutDate || value.check_out_date || value.checkOut || value.endDate || value.end_date;

    if (!startValue || !endValue) {
      throw new Error('checkInDate and checkOutDate are required');
    }

    if (new Date(endValue) <= new Date(startValue)) {
      throw new Error('checkOutDate must be after checkInDate');
    }

    const roomRows = Array.isArray(value.rooms) && value.rooms.length > 0
      ? value.rooms
      : (value.roomTypeId || value.room_id ? [{
          roomTypeId: value.roomTypeId || value.room_id,
          ratePlanId: value.ratePlanId || value.rate_plan_id,
          rooms: value.roomsCount || value.rooms || 1,
          pricePerNight: value.pricePerNight ?? value.price_per_night,
        }] : []);

    if (roomRows.length === 0) {
      throw new Error('At least one room entry is required');
    }

    for (const row of roomRows) {
      if (!row.roomTypeId) {
        throw new Error('Each booking row must include roomTypeId');
      }
      if (Number(row.rooms || 0) < 1) {
        throw new Error('Each booking row must include rooms greater than or equal to 1');
      }
    }

    const totalAmount = Number(value.totalAmount ?? value.total_amount ?? 0);
    const paidAmount = Number(value.paidAmount ?? value.paid_amount ?? 0);
    if (!Number.isNaN(totalAmount) && paidAmount > totalAmount && totalAmount > 0) {
      throw new Error('paidAmount cannot exceed totalAmount');
    }

    return true;
  }),
];

const createManualBookingValidator = [
  ...bookingPayloadValidator,
];

const updateBookingValidator = [
  ...bookingIdValidator,
  ...bookingPayloadValidator,
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
  updateBookingValidator,
  syncBookingsValidator,
};
