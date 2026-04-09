const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { getSmartPrice, applyOccupancyRule, getCompetitorInsight } = require('./pricingEngine');
const { assertRoomTypeAccess } = require('./accessControl');

const normalizeToUtcDate = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const enumerateDatesInclusive = (startDateInput, endDateInput) => {
  const startDate = normalizeToUtcDate(startDateInput);
  const endDate = normalizeToUtcDate(endDateInput);

  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const dates = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

const formatDateKey = (date) => date.toISOString().split('T')[0];

const roundTo2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const applyDynamicPricing = async (roomTypeId, date, basePrice) => {
  const insight = await getSmartPrice(roomTypeId, date, basePrice);
  return insight.smartBasePrice;
};

const getRoomTypeForWrite = async (roomTypeId, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { property: true },
  });

  assertRoomTypeAccess(roomType, user, 'canManagePricing');
  return roomType;
};

const withEffectivePrice = (rate, dynamicBasePrice, competitorInsight = null) => ({
  ...rate,
  dynamicBasePrice,
  effectivePrice: roundTo2(dynamicBasePrice * rate.otaModifier),
  competitorInsight,
});

const updateRate = async (payload, user) => {
  if (Number(payload.basePrice) <= 0) {
    throw new ApiError(400, 'basePrice must be greater than 0');
  }

  const otaModifier = payload.otaModifier !== undefined ? Number(payload.otaModifier) : 1.0;
  if (otaModifier <= 0) {
    throw new ApiError(400, 'otaModifier must be greater than 0');
  }

  await getRoomTypeForWrite(payload.roomTypeId, user);
  const date = normalizeToUtcDate(payload.date);

  const smartPriceInsight = await getSmartPrice(payload.roomTypeId, date, Number(payload.basePrice));
  const dynamicBasePrice = smartPriceInsight.smartBasePrice;

  const rate = await prisma.rate.upsert({
    where: {
      roomTypeId_date: {
        roomTypeId: payload.roomTypeId,
        date,
      },
    },
    create: {
      roomTypeId: payload.roomTypeId,
      date,
      basePrice: Number(payload.basePrice),
      otaModifier,
    },
    update: {
      basePrice: Number(payload.basePrice),
      otaModifier,
    },
  });

  return withEffectivePrice(rate, dynamicBasePrice, smartPriceInsight.competitorInsight);
};

const bulkUpdateRates = async (payload, user) => {
  if (Number(payload.basePrice) <= 0) {
    throw new ApiError(400, 'basePrice must be greater than 0');
  }

  const otaModifier = payload.otaModifier !== undefined ? Number(payload.otaModifier) : 1.0;
  if (otaModifier <= 0) {
    throw new ApiError(400, 'otaModifier must be greater than 0');
  }

  const roomType = await getRoomTypeForWrite(payload.roomTypeId, user);
  const dates = enumerateDatesInclusive(payload.startDate, payload.endDate);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      roomTypeId: payload.roomTypeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      date: true,
      availableRooms: true,
    },
  });

  const inventoryByDate = inventoryRows.reduce((acc, row) => {
    acc[formatDateKey(row.date)] = row.availableRooms;
    return acc;
  }, {});

  const createData = dates.map((date) => ({
    roomTypeId: payload.roomTypeId,
    date,
    basePrice: Number(payload.basePrice),
    otaModifier,
  }));

  return prisma.$transaction(async (tx) => {
    await tx.rate.deleteMany({
      where: {
        roomTypeId: payload.roomTypeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (createData.length > 0) {
      await tx.rate.createMany({ data: createData });
    }

    const entries = await tx.rate.findMany({
      where: {
        roomTypeId: payload.roomTypeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    const enrichedEntries = entries.map((entry) => {
      const dateKey = formatDateKey(entry.date);
      const dynamicBasePrice = applyOccupancyRule(
        entry.basePrice,
        roomType.maxOccupancy
          ? ((roomType.maxOccupancy - (inventoryByDate[dateKey] ?? roomType.maxOccupancy)) / roomType.maxOccupancy) * 100
          : null,
      );
      const competitorInsight = getCompetitorInsight(dynamicBasePrice);

      return withEffectivePrice(entry, dynamicBasePrice, competitorInsight);
    });

    return {
      roomTypeId: payload.roomTypeId,
      updatedCount: enrichedEntries.length,
      entries: enrichedEntries,
    };
  });
};

const getRates = async ({ roomTypeId, startDate, endDate }, user) => {
  const normalizedStartDate = normalizeToUtcDate(startDate);
  const normalizedEndDate = normalizeToUtcDate(endDate);

  if (normalizedEndDate < normalizedStartDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { property: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertRoomTypeAccess(roomType, user, 'canManagePricing');

  const [rates, inventories] = await Promise.all([
    prisma.rate.findMany({
      where: {
        roomTypeId,
        date: {
          gte: normalizedStartDate,
          lte: normalizedEndDate,
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.inventory.findMany({
      where: {
        roomTypeId,
        date: {
          gte: normalizedStartDate,
          lte: normalizedEndDate,
        },
      },
      select: {
        date: true,
        availableRooms: true,
      },
    }),
  ]);

  const inventoryByDate = inventories.reduce((acc, row) => {
    acc[formatDateKey(row.date)] = row.availableRooms;
    return acc;
  }, {});

  const entries = rates.map((rate) => {
    const dynamicBasePrice = applyOccupancyRule(
      rate.basePrice,
      roomType.maxOccupancy
        ? ((roomType.maxOccupancy - (inventoryByDate[formatDateKey(rate.date)] ?? roomType.maxOccupancy)) /
            roomType.maxOccupancy) *
            100
        : null,
    );
    const competitorInsight = getCompetitorInsight(dynamicBasePrice);

    return withEffectivePrice(rate, dynamicBasePrice, competitorInsight);
  });

  return {
    roomTypeId,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    entries,
  };
};

module.exports = {
  updateRate,
  bulkUpdateRates,
  getRates,
  applyDynamicPricing,
};
