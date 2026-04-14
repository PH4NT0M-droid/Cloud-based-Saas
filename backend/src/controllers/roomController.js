const roomService = require('../services/roomService');
const pricingService = require('../services/pricingService');

const createRoomType = async (req, res, next) => {
  try {
    const roomType = await roomService.createRoomType(req.body, req.user);
    return res.status(201).json({
      success: true,
      data: roomType,
    });
  } catch (error) {
    return next(error);
  }
};

const listRoomTypes = async (req, res, next) => {
  try {
    const roomTypes = await roomService.listRoomTypes(req.query.propertyId, req.user);
    return res.status(200).json({
      success: true,
      data: roomTypes,
    });
  } catch (error) {
    return next(error);
  }
};

const updateRoomType = async (req, res, next) => {
  try {
    const roomType = await roomService.updateRoomType(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      data: roomType,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteRoomType = async (req, res, next) => {
  try {
    const result = await roomService.deleteRoomType(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateRoomType = async (req, res, next) => {
  try {
    const result = await roomService.bulkUpdateRoomType(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getPricingGrid = async (req, res, next) => {
  try {
    const result = await pricingService.getPricingGrid(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createRoomType,
  listRoomTypes,
  updateRoomType,
  deleteRoomType,
  bulkUpdateRoomType,
  getPricingGrid,
};
