const analyticsService = require('../services/analyticsService');

const getRevenueAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getRevenueAnalytics(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getOccupancyAnalytics = async (req, res, next) => {
  try {
    const data = await analyticsService.getOccupancyAnalytics(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getOtaPerformance = async (req, res, next) => {
  try {
    const data = await analyticsService.getOtaPerformance();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getMetrics = async (req, res, next) => {
  try {
    const data = await analyticsService.getKeyMetrics(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getRevenueAnalytics,
  getOccupancyAnalytics,
  getOtaPerformance,
  getMetrics,
};
