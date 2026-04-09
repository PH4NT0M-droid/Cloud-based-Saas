const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const roundTo2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeToUtcDate = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const calculateOccupancyPercent = (maxOccupancy, availableRooms) => {
  if (!maxOccupancy || maxOccupancy <= 0 || availableRooms === null || availableRooms === undefined) {
    return null;
  }

  const occupied = Math.max(0, maxOccupancy - availableRooms);
  return Math.max(0, Math.min(100, (occupied / maxOccupancy) * 100));
};

const applyOccupancyRule = (basePrice, occupancyPercent) => {
  if (occupancyPercent === null) {
    return roundTo2(basePrice);
  }

  if (occupancyPercent > 80) {
    return roundTo2(basePrice * 1.2);
  }

  if (occupancyPercent < 30) {
    return roundTo2(basePrice * 0.9);
  }

  return roundTo2(basePrice);
};

const randomInRange = (min, max) => Math.random() * (max - min) + min;

const getCompetitorInsight = (currentPrice) => {
  const competitors = {
    marketA: roundTo2(currentPrice * randomInRange(0.88, 1.14)),
    marketB: roundTo2(currentPrice * randomInRange(0.9, 1.12)),
    marketC: roundTo2(currentPrice * randomInRange(0.87, 1.18)),
  };

  const avgCompetitorPrice = roundTo2((competitors.marketA + competitors.marketB + competitors.marketC) / 3);
  const diffPercent = ((currentPrice - avgCompetitorPrice) / avgCompetitorPrice) * 100;

  let suggestion = 'hold';
  if (diffPercent < -5) {
    suggestion = 'increase';
  } else if (diffPercent > 5) {
    suggestion = 'decrease';
  }

  return {
    competitors,
    avgCompetitorPrice,
    suggestion,
  };
};

const getSmartPrice = async (roomTypeId, date, basePrice) => {
  const normalizedDate = normalizeToUtcDate(date);

  const [roomType, inventory, bookingCount] = await Promise.all([
    prisma.roomType.findUnique({
      where: { id: roomTypeId },
      select: { id: true, maxOccupancy: true },
    }),
    prisma.inventory.findUnique({
      where: {
        roomTypeId_date: {
          roomTypeId,
          date: normalizedDate,
        },
      },
      select: { availableRooms: true },
    }),
    prisma.booking.count({
      where: {
        roomTypeId,
        status: 'CONFIRMED',
        checkIn: {
          lte: normalizedDate,
        },
        checkOut: {
          gt: normalizedDate,
        },
      },
    }),
  ]);

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  const inventoryOccupancy = calculateOccupancyPercent(roomType.maxOccupancy, inventory?.availableRooms);
  const bookingOccupancy = roomType.maxOccupancy > 0 ? (bookingCount / roomType.maxOccupancy) * 100 : null;
  const occupancyPercent =
    inventoryOccupancy === null
      ? bookingOccupancy
      : Math.max(inventoryOccupancy, bookingOccupancy === null ? 0 : bookingOccupancy);
  const smartBasePrice = applyOccupancyRule(Number(basePrice), occupancyPercent);
  const competitorInsight = getCompetitorInsight(smartBasePrice);

  return {
    smartBasePrice,
    occupancyPercent,
    competitorInsight,
  };
};

module.exports = {
  getSmartPrice,
  applyOccupancyRule,
  calculateOccupancyPercent,
  getCompetitorInsight,
};
