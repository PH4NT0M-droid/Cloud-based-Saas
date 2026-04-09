const otaService = require('../services/ota/otaService');

const syncInventory = async (req, res, next) => {
  try {
    const { roomTypeId, startDate, endDate, otas } = req.body;
    const data = await otaService.syncAllInventory(roomTypeId, { startDate, endDate }, otas, req.user);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const syncRates = async (req, res, next) => {
  try {
    const { roomTypeId, startDate, endDate, otas } = req.body;
    const data = await otaService.syncAllRates(roomTypeId, { startDate, endDate }, otas, req.user);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

const fetchBookings = async (req, res, next) => {
  try {
    const otas = req.query.otas ? req.query.otas.split(',').map((item) => item.trim()).filter(Boolean) : undefined;
    const data = await otaService.fetchAllBookings(otas, req.user);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  syncInventory,
  syncRates,
  fetchBookings,
};
