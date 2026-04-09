const { body, param, query } = require('express-validator');

const createRoomValidator = [
  body('propertyId').isUUID().withMessage('propertyId must be a valid UUID'),
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('maxOccupancy')
    .isInt({ min: 1, max: 20 })
    .withMessage('maxOccupancy must be an integer between 1 and 20'),
];

const updateRoomValidator = [
  param('id').isUUID().withMessage('Room type id must be a valid UUID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be 2-120 characters'),
  body('maxOccupancy')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('maxOccupancy must be an integer between 1 and 20'),
];

const listRoomsValidator = [
  query('propertyId').optional().isUUID().withMessage('propertyId must be a valid UUID'),
];

const roomIdValidator = [param('id').isUUID().withMessage('Room type id must be a valid UUID')];

module.exports = {
  createRoomValidator,
  updateRoomValidator,
  listRoomsValidator,
  roomIdValidator,
};
