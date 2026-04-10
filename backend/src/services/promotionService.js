const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const normalizePromotionPayload = (payload) => {
  const discountPercent = Number(payload.discountPercent ?? payload.discount ?? 0);
  if (discountPercent < 0 || discountPercent > 100) {
    throw new ApiError(400, 'discountPercent must be between 0 and 100');
  }

  const propertyIds = Array.isArray(payload.propertyIds) ? payload.propertyIds : [];

  return {
    name: payload.name,
    discountPercent,
    season: payload.season || null,
    propertyIds,
    startDate: payload.startDate ? new Date(payload.startDate) : null,
    endDate: payload.endDate ? new Date(payload.endDate) : null,
  };
};

const listPromotions = async () => {
  const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  return promotions.map((promotion) => ({
    ...promotion,
    propertyIds: Array.isArray(promotion.propertyIds) ? promotion.propertyIds : [],
  }));
};

const createPromotion = async (payload) => {
  const data = normalizePromotionPayload(payload);
  return prisma.promotion.create({ data });
};

const updatePromotion = async (id, payload) => {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, 'Promotion not found');
  }

  const data = normalizePromotionPayload({ ...existing, ...payload });
  return prisma.promotion.update({ where: { id }, data });
};

const deletePromotion = async (id) => {
  await prisma.promotion.delete({ where: { id } });
  return { id };
};

const getApplicableDiscountPercent = async ({ propertyId, date, txClient }) => {
  const db = txClient || prisma;
  const promotions = await db.promotion.findMany();
  const targetDate = new Date(date);

  const applicable = promotions.filter((promotion) => {
    const propertyIds = Array.isArray(promotion.propertyIds) ? promotion.propertyIds : [];
    const matchesProperty = propertyIds.length === 0 || propertyIds.includes(propertyId);
    const inStart = !promotion.startDate || new Date(promotion.startDate) <= targetDate;
    const inEnd = !promotion.endDate || new Date(promotion.endDate) >= targetDate;
    return matchesProperty && inStart && inEnd;
  });

  if (applicable.length === 0) {
    return 0;
  }

  return Math.max(...applicable.map((promotion) => Number(promotion.discountPercent || 0)));
};

module.exports = {
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getApplicableDiscountPercent,
};
