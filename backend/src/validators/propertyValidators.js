const { body, param } = require('express-validator');

const createPropertyValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 150 }).withMessage('Name must be 2-150 characters'),
  body('location')
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be 2-200 characters'),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Description must be 5-1000 characters'),
];

const updatePropertyValidator = [
  param('id').isUUID().withMessage('Property id must be a valid UUID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Name must be 2-150 characters'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be 2-200 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Description must be 5-1000 characters'),
];

const propertyIdValidator = [param('id').isUUID().withMessage('Property id must be a valid UUID')];

module.exports = {
  createPropertyValidator,
  updatePropertyValidator,
  propertyIdValidator,
};
