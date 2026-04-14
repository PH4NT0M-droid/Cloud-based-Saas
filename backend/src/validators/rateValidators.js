const { body, query } = require('express-validator');

const updateRateValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('ratePlanId').optional().isUUID().withMessage('ratePlanId must be a valid UUID'),
  body('date').isISO8601().withMessage('date must be a valid ISO date'),
  body('price').optional().isFloat({ min: 0 }).withMessage('price must be greater than or equal to 0'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('basePrice must be greater than or equal to 0'),
  body().custom((value) => {
    if (value.price === undefined && value.basePrice === undefined) {
      throw new Error('price or basePrice is required');
    }
    return true;
  }),
];

const bulkUpdateRateValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('ratePlanId').optional().isUUID().withMessage('ratePlanId must be a valid UUID'),
  body('applyToAll').optional().isBoolean().withMessage('applyToAll must be a boolean'),
  body('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO date')
    .custom((value, { req }) => new Date(value) >= new Date(req.body.startDate))
    .withMessage('endDate must be on or after startDate'),
  body('price').optional().isFloat({ min: 0 }).withMessage('price must be greater than or equal to 0'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('basePrice must be greater than or equal to 0'),
  body().custom((value) => {
    if (value.price === undefined && value.basePrice === undefined) {
      throw new Error('price or basePrice is required');
    }
    return true;
  }),
];

const getRatesValidator = [
  query('roomTypeId').optional().isUUID().withMessage('roomTypeId must be a valid UUID'),
  query('propertyId').optional().isUUID().withMessage('propertyId must be a valid UUID'),
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
