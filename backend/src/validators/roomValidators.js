const { body, param, query } = require('express-validator');

const createRoomValidator = [
  body('propertyId').isUUID().withMessage('propertyId must be a valid UUID'),
  body('name').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
  body('base_price').optional().isFloat({ min: 0 }).withMessage('base_price must be greater than or equal to 0'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('basePrice must be greater than or equal to 0'),
  body('extra_person_price').optional().isFloat({ min: 0 }).withMessage('extra_person_price must be greater than or equal to 0'),
  body('extraPersonPrice').optional().isFloat({ min: 0 }).withMessage('extraPersonPrice must be greater than or equal to 0'),
  body('base_capacity').optional().isInt({ min: 1, max: 20 }).withMessage('base_capacity must be an integer between 1 and 20'),
  body('baseCapacity').optional().isInt({ min: 1, max: 20 }).withMessage('baseCapacity must be an integer between 1 and 20'),
  body('max_capacity').optional().isInt({ min: 1, max: 20 }).withMessage('max_capacity must be an integer between 1 and 20'),
  body('maxCapacity').optional().isInt({ min: 1, max: 20 }).withMessage('maxCapacity must be an integer between 1 and 20'),
  body('base_inventory').optional().isInt({ min: 0 }).withMessage('base_inventory must be an integer greater than or equal to 0'),
  body('baseInventory').optional().isInt({ min: 0 }).withMessage('baseInventory must be an integer greater than or equal to 0'),
  body('maxOccupancy').optional().isInt({ min: 1, max: 20 }).withMessage('maxOccupancy must be an integer between 1 and 20'),
  body().custom((value) => {
    const baseCapacity = Number(value.baseCapacity ?? value.base_capacity ?? 1);
    const maxCapacity = Number(value.maxCapacity ?? value.max_capacity ?? value.maxOccupancy ?? 0);
    if (!maxCapacity) {
      throw new Error('maxCapacity or maxOccupancy is required');
    }
    return maxCapacity >= baseCapacity;
  })
    .withMessage('maxCapacity must be greater than or equal to baseCapacity'),
];

const updateRoomValidator = [
  param('id').isUUID().withMessage('Room type id must be a valid UUID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Name must be 2-120 characters'),
  body('base_price').optional().isFloat({ min: 0 }).withMessage('base_price must be greater than or equal to 0'),
  body('basePrice').optional().isFloat({ min: 0 }).withMessage('basePrice must be greater than or equal to 0'),
  body('extra_person_price').optional().isFloat({ min: 0 }).withMessage('extra_person_price must be greater than or equal to 0'),
  body('extraPersonPrice').optional().isFloat({ min: 0 }).withMessage('extraPersonPrice must be greater than or equal to 0'),
  body('base_capacity').optional().isInt({ min: 1, max: 20 }).withMessage('base_capacity must be an integer between 1 and 20'),
  body('baseCapacity').optional().isInt({ min: 1, max: 20 }).withMessage('baseCapacity must be an integer between 1 and 20'),
  body('max_capacity').optional().isInt({ min: 1, max: 20 }).withMessage('max_capacity must be an integer between 1 and 20'),
  body('maxCapacity').optional().isInt({ min: 1, max: 20 }).withMessage('maxCapacity must be an integer between 1 and 20'),
  body('base_inventory').optional().isInt({ min: 0 }).withMessage('base_inventory must be an integer greater than or equal to 0'),
  body('baseInventory').optional().isInt({ min: 0 }).withMessage('baseInventory must be an integer greater than or equal to 0'),
  body('maxOccupancy').optional().isInt({ min: 1, max: 20 }).withMessage('maxOccupancy must be an integer between 1 and 20'),
  body().custom((value) => {
    const baseCapacity = value.baseCapacity ?? value.base_capacity;
    const maxCapacity = value.maxCapacity ?? value.max_capacity ?? value.maxOccupancy;
    if (baseCapacity === undefined || maxCapacity === undefined) {
      return true;
    }
    return Number(maxCapacity) >= Number(baseCapacity);
  }).withMessage('maxCapacity must be greater than or equal to baseCapacity'),
];

const listRoomsValidator = [
  query('propertyId').optional().isUUID().withMessage('propertyId must be a valid UUID'),
];

const roomIdValidator = [param('id').isUUID().withMessage('Room type id must be a valid UUID')];

const bulkUpdateRoomValidator = [
  body('roomTypeId').optional().isUUID().withMessage('roomTypeId must be a valid UUID'),
  body('room_id').optional().isUUID().withMessage('room_id must be a valid UUID'),
  body().custom((value) => {
    if (!value.roomTypeId && !value.room_id) {
      throw new Error('roomTypeId or room_id is required');
    }
    return true;
  }),
  body('startDate').optional().isISO8601().withMessage('startDate must be a valid ISO date'),
  body('endDate').optional().isISO8601().withMessage('endDate must be a valid ISO date'),
  body('start_date').optional().isISO8601().withMessage('start_date must be a valid ISO date'),
  body('end_date').optional().isISO8601().withMessage('end_date must be a valid ISO date'),
  body().custom((value) => {
    const start = value.startDate || value.start_date;
    const end = value.endDate || value.end_date;
    if (!start || !end) {
      throw new Error('startDate/start_date and endDate/end_date are required');
    }
    return new Date(end) >= new Date(start);
  }).withMessage('end date must be on or after start date'),
  body('operation').isIn(['increase', 'decrease', 'set']).withMessage('operation must be increase, decrease, or set'),
  body('type').isIn(['price', 'inventory']).withMessage('type must be price or inventory'),
  body('value').isFloat({ min: 0 }).withMessage('value must be greater than or equal to 0'),
];

module.exports = {
  createRoomValidator,
  updateRoomValidator,
  listRoomsValidator,
  roomIdValidator,
  bulkUpdateRoomValidator,
};
