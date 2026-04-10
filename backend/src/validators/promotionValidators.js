const { body, param } = require('express-validator');

const basePromotionValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('name must be 2-120 characters'),
  body('discountPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('discountPercent must be 0-100'),
  body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('discount must be 0-100'),
  body('season').optional({ nullable: true }).isString().isLength({ max: 60 }).withMessage('season must be max 60 chars'),
  body('propertyIds').optional().isArray().withMessage('propertyIds must be an array'),
  body('propertyIds.*').optional().isUUID().withMessage('propertyIds must contain UUIDs'),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('startDate must be a valid date'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('endDate must be a valid date'),
  body().custom((value) => {
    if (!value.startDate || !value.endDate) {
      return true;
    }
    return new Date(value.endDate) >= new Date(value.startDate);
  }).withMessage('endDate must be on or after startDate'),
];

const promotionIdValidator = [param('id').isUUID().withMessage('id must be a valid UUID')];

const createPromotionValidator = [...basePromotionValidator];
const updatePromotionValidator = [...promotionIdValidator, ...basePromotionValidator];
const deletePromotionValidator = [...promotionIdValidator];

module.exports = {
  createPromotionValidator,
  updatePromotionValidator,
  deletePromotionValidator,
};
