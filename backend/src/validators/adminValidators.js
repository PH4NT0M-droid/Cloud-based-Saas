const { body, param } = require('express-validator');

const permissionFields = ['canManageProperties', 'canManageRooms', 'canManagePricing', 'canManageInventory'];

const permissionValidator = permissionFields.map((field) =>
  body(`permissions.${field}`).optional().isBoolean().withMessage(`${field} must be a boolean`),
);

const propertyIdsValidator = body('propertyIds').optional().isArray().withMessage('propertyIds must be an array');

const createManagerValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('email').isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 100 }).withMessage('Password must be at least 8 characters'),
  ...permissionValidator,
  propertyIdsValidator,
];

const updateManagerValidator = [
  param('id').isUUID().withMessage('Manager id must be a valid UUID'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('email').optional().isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('password').optional().isString().isLength({ min: 8, max: 100 }).withMessage('Password must be at least 8 characters'),
  ...permissionValidator,
  propertyIdsValidator,
];

const deleteManagerValidator = [param('id').isUUID().withMessage('Manager id must be a valid UUID')];

const assignPropertyValidator = [
  body('userId').isUUID().withMessage('userId must be a valid UUID'),
  body('propertyId').isUUID().withMessage('propertyId must be a valid UUID'),
];

const removePropertyValidator = [
  body('userId').isUUID().withMessage('userId must be a valid UUID'),
  body('propertyId').isUUID().withMessage('propertyId must be a valid UUID'),
];

module.exports = {
  createManagerValidator,
  updateManagerValidator,
  deleteManagerValidator,
  assignPropertyValidator,
  removePropertyValidator,
};