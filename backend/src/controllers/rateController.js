const rateService = require('../services/rateService');

const updateRate = async (req, res, next) => {
  try {
    const result = await rateService.updateRate(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const updatePricing = async (req, res, next) => {
  try {
    const result = await rateService.updatePricing(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdateRates = async (req, res, next) => {
  try {
    const result = await rateService.bulkUpdateRates(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const bulkUpdatePricing = async (req, res, next) => {
  try {
    const result = await rateService.bulkUpdatePricing(req.body, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getRates = async (req, res, next) => {
  try {
    const result = await rateService.getRates(req.query, req.user);
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
    const result = await rateService.getPricingGrid(req.query, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  updateRate,
  updatePricing,
  bulkUpdateRates,
  bulkUpdatePricing,
  getRates,
  getPricingGrid,
};
