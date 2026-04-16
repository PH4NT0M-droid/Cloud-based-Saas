const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
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

const applyOccupancyRule = (basePrice, occupancyPercent) => {
  if (occupancyPercent === null || occupancyPercent === undefined) {
    return basePrice;
  }

  if (occupancyPercent > 80) {
    return basePrice * 1.2;
  }

  if (occupancyPercent < 30) {
    return basePrice * 0.9;
  }

  return basePrice;
};

const getRoomTypeForWrite = async (roomTypeId, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: {
      property: true,
      ratePlans: {
        orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
      },
    },
  });

  assertRoomTypeAccess(roomType, user, 'canManagePricing');
  return roomType;
};

const getPlanLabel = (ratePlan) => String(ratePlan?.mealPlanName || '').trim().toUpperCase();

const pickDefaultPlan = (ratePlans = []) => ratePlans.find((plan) => plan.isDefault) || ratePlans[0] || null;

const seedMissingRoomPricing = async ({ tx, roomType, startDate, endDate }) => {
  const ratePlans = Array.isArray(roomType.ratePlans) ? roomType.ratePlans : [];
  if (ratePlans.length === 0) {
    return;
  }

  const existing = await tx.roomPricing.findMany({
    where: {
      roomTypeId: roomType.id,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      ratePlanId: true,
      date: true,
    },
  });

  const existingSet = new Set(existing.map((item) => `${item.ratePlanId}:${formatDateKey(item.date)}`));
  const legacyRates = tx?.rate?.findMany
    ? await tx.rate.findMany({
      where: {
        roomTypeId: roomType.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        date: true,
        basePrice: true,
      },
    })
    : [];

  const legacyRateByDate = legacyRates.reduce((acc, item) => {
    acc[formatDateKey(item.date)] = Number(item.basePrice ?? roomType.basePrice ?? 0);
    return acc;
  }, {});

  const dates = enumerateDatesInclusive(startDate, endDate);
  const seedRows = [];
  for (const date of dates) {
    const dateKey = formatDateKey(date);
    const basePrice = Number(legacyRateByDate[dateKey] ?? roomType.basePrice ?? 0);
    for (const plan of ratePlans) {
      const rowKey = `${plan.id}:${dateKey}`;
      if (existingSet.has(rowKey)) {
        continue;
      }
      seedRows.push({
        roomTypeId: roomType.id,
        ratePlanId: plan.id,
        date,
        price: basePrice,
      });
    }
  }

  if (seedRows.length > 0) {
    await tx.roomPricing.createMany({ data: seedRows });
  }
};

const updatePricing = async (payload, user) => {
  const roomTypeId = payload.roomTypeId || payload.room_id;
  const ratePlanId = payload.ratePlanId || payload.rate_plan_id;
  const date = normalizeToUtcDate(payload.date);
  const price = Number(payload.price ?? payload.basePrice);

  if (!roomTypeId) {
    throw new ApiError(400, 'roomTypeId is required');
  }

  if (price < 0) {
    throw new ApiError(400, 'price must be greater than or equal to 0');
  }

  const roomType = await getRoomTypeForWrite(roomTypeId, user);
  const selectedPlan = ratePlanId
    ? roomType.ratePlans.find((plan) => plan.id === ratePlanId)
    : pickDefaultPlan(roomType.ratePlans);
  if (!selectedPlan) {
    throw new ApiError(400, 'Selected rate plan does not belong to room type');
  }

  const targetRatePlanId = selectedPlan.id;

  const row = await prisma.roomPricing.upsert({
    where: {
      roomTypeId_ratePlanId_date: {
        roomTypeId,
        ratePlanId: targetRatePlanId,
        date,
      },
    },
    create: {
      roomTypeId,
      ratePlanId: targetRatePlanId,
      date,
      price,
    },
    update: {
      price,
    },
    include: {
      ratePlan: true,
    },
  });

  return {
    id: row.id,
    roomTypeId: row.roomTypeId,
    ratePlanId: row.ratePlanId,
    date: row.date,
    price: row.price,
    mealPlanName: getPlanLabel(row.ratePlan),
  };
};

const bulkUpdatePricing = async (payload, user) => {
  const roomTypeId = payload.roomTypeId || payload.room_id;
  const startDate = normalizeToUtcDate(payload.startDate);
  const endDate = normalizeToUtcDate(payload.endDate);
  const price = Number(payload.price ?? payload.basePrice);
  const ratePlanId = payload.ratePlanId || payload.rate_plan_id || null;
  const applyToAll = Boolean(payload.applyToAll || payload.apply_to_all || String(payload.ratePlanId || '').toUpperCase() === 'ALL');

  if (!roomTypeId) {
    throw new ApiError(400, 'roomTypeId is required');
  }

  if (price < 0) {
    throw new ApiError(400, 'price must be greater than or equal to 0');
  }

  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const roomType = await getRoomTypeForWrite(roomTypeId, user);
  if (!Array.isArray(roomType.ratePlans) || roomType.ratePlans.length === 0) {
    throw new ApiError(400, 'Room type has no rate plans');
  }

  const targetPlans = applyToAll
    ? roomType.ratePlans
    : roomType.ratePlans.filter((plan) => (ratePlanId ? plan.id === ratePlanId : plan.isDefault));

  if (!applyToAll && targetPlans.length === 0) {
    throw new ApiError(400, 'Selected rate plan does not belong to room type');
  }

  const dates = enumerateDatesInclusive(startDate, endDate);

  return prisma.$transaction(async (tx) => {
    const rows = [];
    for (const date of dates) {
      for (const plan of targetPlans) {
        rows.push({
          roomTypeId,
          ratePlanId: plan.id,
          date,
          price,
        });
      }
    }

    if (rows.length > 0) {
      await tx.roomPricing.createMany({
        data: rows,
        skipDuplicates: true,
      });

      for (const row of rows) {
        await tx.roomPricing.update({
          where: {
            roomTypeId_ratePlanId_date: {
              roomTypeId: row.roomTypeId,
              ratePlanId: row.ratePlanId,
              date: row.date,
            },
          },
          data: { price: row.price },
        });
      }
    }

    return {
      roomTypeId,
      updatedCount: rows.length,
      applyToAll,
      ratePlanIds: targetPlans.map((plan) => plan.id),
    };
  });
};

const getPricingGrid = async ({ propertyId, roomTypeId, startDate, endDate }, user) => {
  const normalizedStartDate = normalizeToUtcDate(startDate);
  const normalizedEndDate = normalizeToUtcDate(endDate);

  if (normalizedEndDate < normalizedStartDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const roomTypeFilter = roomTypeId ? { id: roomTypeId } : {};
  const propertyFilter = propertyId ? { propertyId } : {};

  const roomTypes = await prisma.roomType.findMany({
    where: {
      ...roomTypeFilter,
      ...propertyFilter,
    },
    include: {
      property: true,
      ratePlans: {
        orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
      },
      roomPricings: {
        where: {
          date: {
            gte: normalizedStartDate,
            lte: normalizedEndDate,
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const roomType of roomTypes) {
    assertRoomTypeAccess(roomType, user, 'canManagePricing');
  }

  const rangeDates = enumerateDatesInclusive(normalizedStartDate, normalizedEndDate);

  return prisma.$transaction(async (tx) => {
    for (const roomType of roomTypes) {
      await seedMissingRoomPricing({
        tx,
        roomType,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      });
    }

    const refreshed = await tx.roomType.findMany({
      where: {
        ...roomTypeFilter,
        ...propertyFilter,
      },
      include: {
        ratePlans: {
          orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
        },
        roomPricings: {
          where: {
            date: {
              gte: normalizedStartDate,
              lte: normalizedEndDate,
            },
          },
          include: {
            ratePlan: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows = refreshed.map((roomType) => {
      const defaultPlan = pickDefaultPlan(roomType.ratePlans);
      const planRows = roomType.ratePlans.map((plan) => {
        const prices = {};
        for (const date of rangeDates) {
          const key = formatDateKey(date);
          const priceRow = roomType.roomPricings.find(
            (item) => item.ratePlanId === plan.id && formatDateKey(item.date) === key,
          );
          prices[key] = Number(priceRow?.price ?? roomType.basePrice ?? 0);
        }

        return {
          ratePlanId: plan.id,
          mealPlanName: getPlanLabel(plan),
          isDefault: Boolean(plan.isDefault),
          prices,
        };
      });

      return {
        roomTypeId: roomType.id,
        roomTypeName: roomType.name,
        defaultRatePlanId: defaultPlan?.id || null,
        ratePlans: planRows,
      };
    });

    return {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      dates: rangeDates.map((date) => formatDateKey(date)),
      rows,
    };
  });
};

const getPriceForBookingDate = async ({ tx, roomTypeId, ratePlanId, date }) => {
  const pricing = tx?.roomPricing?.findUnique
    ? await tx.roomPricing.findUnique({
    where: {
      roomTypeId_ratePlanId_date: {
        roomTypeId,
        ratePlanId,
        date,
      },
    },
    select: { price: true },
  })
    : null;

  if (pricing) {
    return Number(pricing.price);
  }

  const legacyRate = tx?.rate?.findUnique
    ? await tx.rate.findUnique({
    where: {
      roomTypeId_date: {
        roomTypeId,
        date,
      },
    },
    select: { basePrice: true },
  })
    : null;

  if (legacyRate) {
    return Number(legacyRate.basePrice ?? 0);
  }

  const roomType = await tx.roomType.findUnique({
    where: { id: roomTypeId },
    select: { basePrice: true },
  });

  return Number(roomType?.basePrice ?? 0);
};

const applyDynamicPricing = async (roomTypeId, date, basePrice) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    select: { maxOccupancy: true },
  });

  const inventory = await prisma.inventory.findUnique({
    where: {
      roomTypeId_date: {
        roomTypeId,
        date: normalizeToUtcDate(date),
      },
    },
    select: { availableRooms: true },
  });

  const occupancyPercent = roomType?.maxOccupancy
    ? ((roomType.maxOccupancy - (inventory?.availableRooms ?? roomType.maxOccupancy)) / roomType.maxOccupancy) * 100
    : null;

  return roundTo2(applyOccupancyRule(Number(basePrice || 0), occupancyPercent));
};

const updateRate = async (payload, user) => {
  const roomType = await getRoomTypeForWrite(payload.roomTypeId, user);
  const date = normalizeToUtcDate(payload.date);
  const basePrice = Number(payload.basePrice ?? payload.price ?? 0);
  const otaModifier = payload.otaModifier !== undefined ? Number(payload.otaModifier) : 1.0;

  if (basePrice < 0) {
    throw new ApiError(400, 'basePrice must be greater than or equal to 0');
  }

  if (otaModifier <= 0) {
    throw new ApiError(400, 'otaModifier must be greater than 0');
  }

  const dynamicBasePrice = await applyDynamicPricing(payload.roomTypeId, date, basePrice);

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
      basePrice,
      otaModifier,
    },
    update: {
      basePrice,
      otaModifier,
    },
  });

  return {
    ...rate,
    dynamicBasePrice,
    effectivePrice: roundTo2(dynamicBasePrice * otaModifier),
    maxOccupancy: roomType.maxOccupancy,
  };
};

const bulkUpdateRates = async (payload, user) => {
  const roomType = await getRoomTypeForWrite(payload.roomTypeId, user);
  const startDate = normalizeToUtcDate(payload.startDate);
  const endDate = normalizeToUtcDate(payload.endDate);
  const basePrice = Number(payload.basePrice ?? payload.price ?? 0);
  const otaModifier = payload.otaModifier !== undefined ? Number(payload.otaModifier) : 1.0;

  if (basePrice < 0) {
    throw new ApiError(400, 'basePrice must be greater than or equal to 0');
  }

  if (otaModifier <= 0) {
    throw new ApiError(400, 'otaModifier must be greater than 0');
  }

  const dates = enumerateDatesInclusive(startDate, endDate);

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

    if (dates.length > 0) {
      await tx.rate.createMany({
        data: dates.map((date) => ({
          roomTypeId: payload.roomTypeId,
          date,
          basePrice,
          otaModifier,
        })),
      });
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

    return {
      roomTypeId: payload.roomTypeId,
      updatedCount: entries.length,
      entries: entries.map((entry) => {
        const dynamicBasePrice = applyOccupancyRule(
          Number(entry.basePrice || 0),
          roomType.maxOccupancy ? 50 : null,
        );
        return {
          ...entry,
          dynamicBasePrice,
          effectivePrice: roundTo2(dynamicBasePrice * Number(entry.otaModifier || 1)),
        };
      }),
    };
  });
};

const getRates = async ({ roomTypeId, startDate, endDate }, user) => {
  const normalizedStartDate = normalizeToUtcDate(startDate);
  const normalizedEndDate = normalizeToUtcDate(endDate);

  if (!roomTypeId) {
    throw new ApiError(400, 'roomTypeId is required');
  }

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
    const occupancyPercent = roomType.maxOccupancy
      ? ((roomType.maxOccupancy - (inventoryByDate[formatDateKey(rate.date)] ?? roomType.maxOccupancy)) / roomType.maxOccupancy) * 100
      : null;
    const dynamicBasePrice = applyOccupancyRule(Number(rate.basePrice || 0), occupancyPercent);

    return {
      ...rate,
      dynamicBasePrice,
      effectivePrice: roundTo2(dynamicBasePrice * Number(rate.otaModifier || 1)),
    };
  });

  return {
    roomTypeId,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    entries,
  };
};

module.exports = {
  updatePricing,
  bulkUpdatePricing,
  getPricingGrid,
  getPriceForBookingDate,
  updateRate,
  bulkUpdateRates,
  getRates,
  applyDynamicPricing,
};
