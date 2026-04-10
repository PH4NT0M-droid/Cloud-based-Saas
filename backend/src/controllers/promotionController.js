const promotionService = require('../services/promotionService');

const listPromotions = async (req, res, next) => {
  try {
    const items = await promotionService.listPromotions();
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
};

const createPromotion = async (req, res, next) => {
  try {
    const item = await promotionService.createPromotion(req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

const updatePromotion = async (req, res, next) => {
  try {
    const item = await promotionService.updatePromotion(req.params.id, req.body);
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

const deletePromotion = async (req, res, next) => {
  try {
    const result = await promotionService.deletePromotion(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
