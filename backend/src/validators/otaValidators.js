const { body, query } = require('express-validator');

const supportedOtas = ['booking', 'airbnb', 'makemytrip', 'agoda'];

const validateOtaList = (value) => {
  if (value === undefined) {
    return true;
  }

  if (!Array.isArray(value)) {
    throw new Error('otas must be an array');
  }

  const invalid = value.filter((ota) => !supportedOtas.includes(ota));
  if (invalid.length > 0) {
    throw new Error(`Unsupported OTA(s): ${invalid.join(', ')}`);
  }

  return true;
};

const syncValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO date')
    .custom((value, { req }) => new Date(value) >= new Date(req.body.startDate))
    .withMessage('endDate must be on or after startDate'),
  body('otas').optional().custom(validateOtaList),
];

const bookingsValidator = [
  query('otas')
    .optional()
    .custom((value) => {
      const parsed = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const invalid = parsed.filter((ota) => !supportedOtas.includes(ota));
      if (invalid.length > 0) {
        throw new Error(`Unsupported OTA(s): ${invalid.join(', ')}`);
      }
      return true;
    }),
];

module.exports = {
  syncValidator,
  bookingsValidator,
};
