const { body, param } = require('express-validator');

const permissionFields = ['canManageProperties', 'canManageRooms', 'canManagePricing', 'canManageInventory', 'manage_bookings'];

const permissionValidator = permissionFields.map((field) =>
  body(`permissions.${field}`).optional().isBoolean().withMessage(`${field} must be a boolean`),
);

const permissionAliasValidator = [body('permissions.canManageBookings').optional().isBoolean().withMessage('canManageBookings must be a boolean')];

const propertyIdsValidator = [
  body('propertyIds').optional().isArray().withMessage('propertyIds must be an array'),
  body('propertyIds.*').optional().isUUID().withMessage('Each property id must be a valid UUID'),
];

const propertyPermissionsValidator = [
  body('propertyPermissions').optional().isObject().withMessage('propertyPermissions must be an object'),
  body('propertyPermissions').optional().custom((value) => {
    if (value === null || value === undefined) {
      return true;
    }

    for (const [propertyId, permissions] of Object.entries(value)) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(propertyId)) {
        throw new Error('Each propertyPermissions key must be a valid UUID');
      }

      if (!Array.isArray(permissions)) {
        throw new Error('Each propertyPermissions value must be an array of permissions');
      }

      for (const permission of permissions) {
        if (typeof permission !== 'string' || permission.trim().length === 0) {
          throw new Error('Each property permission must be a non-empty string');
        }
      }
    }

    return true;
  }),
];

const createManagerValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('email').isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('password').isString().isLength({ min: 6, max: 100 }).withMessage('Password must be at least 6 characters'),
  ...permissionValidator,
  ...permissionAliasValidator,
  propertyIdsValidator,
  ...propertyPermissionsValidator,
];

const updateManagerValidator = [
  param('id').isUUID().withMessage('Manager id must be a valid UUID'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('email').optional().isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('password').optional({ checkFalsy: true, nullable: true }).isString().isLength({ min: 1, max: 100 }).withMessage('Password must be 1-100 characters'),
  ...permissionValidator,
  ...permissionAliasValidator,
  propertyIdsValidator,
  ...propertyPermissionsValidator,
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