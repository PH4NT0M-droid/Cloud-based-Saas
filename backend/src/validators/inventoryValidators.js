const { body, query } = require('express-validator');

const isEndDateOnOrAfterStartDate = (startField, endField) => (value, { req }) => {
  const startDate = new Date(req[startField === 'startDate' ? 'body' : 'query'][startField]);
  const endDate = new Date(value);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return false;
  }

  return endDate >= startDate;
};

const updateInventoryValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('date').isISO8601().withMessage('date must be a valid ISO date'),
  body('availableRooms')
    .isInt({ min: 0 })
    .withMessage('availableRooms must be an integer greater than or equal to 0'),
];

const bulkUpdateInventoryValidator = [
  body('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO date')
    .custom(isEndDateOnOrAfterStartDate('startDate', 'endDate'))
    .withMessage('endDate must be on or after startDate'),
  body('availableRooms')
    .isInt({ min: 0 })
    .withMessage('availableRooms must be an integer greater than or equal to 0'),
];

const getInventoryCalendarValidator = [
  query('roomTypeId').isUUID().withMessage('roomTypeId must be a valid UUID'),
  query('startDate').isISO8601().withMessage('startDate must be a valid ISO date'),
  query('endDate')
    .isISO8601()
    .withMessage('endDate must be a valid ISO date')
    .custom((value, { req }) => {
      const startDate = new Date(req.query.startDate);
      const endDate = new Date(value);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return false;
      }

      return endDate >= startDate;
    })
    .withMessage('endDate must be on or after startDate'),
];

module.exports = {
  updateInventoryValidator,
  bulkUpdateInventoryValidator,
  getInventoryCalendarValidator,
};
