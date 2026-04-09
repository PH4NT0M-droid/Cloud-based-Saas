const { body, query } = require('express-validator');

const updateRateValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('date').isISO8601().withMessage('date must be a valid ISO date'),
  body('basePrice').isFloat({ gt: 0 }).withMessage('basePrice must be greater than 0'),
  body('otaModifier')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('otaModifier must be greater than 0'),
];

const bulkUpdateRateValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO date')
    .custom((value, { req }) => new Date(value) >= new Date(req.body.startDate))
    .withMessage('endDate must be on or after startDate'),
  body('basePrice').isFloat({ gt: 0 }).withMessage('basePrice must be greater than 0'),
  body('otaModifier')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('otaModifier must be greater than 0'),
];

const getRatesValidator = [
  query('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  query('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
  query('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO date')
    .custom((value, { req }) => new Date(value) >= new Date(req.query.startDate))
    .withMessage('endDate must be on or after startDate'),
];

module.exports = {
  updateRateValidator,
  bulkUpdateRateValidator,
  getRatesValidator,
};
