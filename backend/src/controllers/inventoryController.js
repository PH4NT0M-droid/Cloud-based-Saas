const inventoryService = require('../services/inventoryService');

const updateInventory = async (req, res, next) => {
  try {
    const inventory = await inventoryService.updateInventory(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateInventory = async (req, res, next) => {
  try {
    const result = await inventoryService.bulkUpdateInventory(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getInventoryCalendar = async (req, res, next) => {
  try {
    const result = await inventoryService.getInventoryCalendar(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  updateInventory,
  bulkUpdateInventory,
  getInventoryCalendar,
};
