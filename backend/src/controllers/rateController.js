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

module.exports = {
  updateRate,
  bulkUpdateRates,
  getRates,
};
