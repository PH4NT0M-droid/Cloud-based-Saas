const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { assertPropertyAccess, assertPropertyMutationAccess } = require('./accessControl');
const { enumerateDatesInclusive } = require('./dateService');

const toNumberOrUndefined = (value) => (value === undefined ? undefined : Number(value));

const normalizeMealPlanName = (value) => String(value || '').trim().toUpperCase();

const normalizeRatePlans = (ratePlansInput, currentRatePlans = []) => {
  if (ratePlansInput === undefined || ratePlansInput === null) {
    return null;
  }

  const ratePlansArray = Array.isArray(ratePlansInput)
    ? ratePlansInput
    : typeof ratePlansInput === 'object'
      ? Object.entries(ratePlansInput).map(([mealPlanName, value]) => ({
          mealPlanName,
          ...(value && typeof value === 'object' ? value : { price: value }),
        }))
      : [];

  if (ratePlansArray.length === 0) {
    return [];
  }

  const seenNames = new Set();
  const normalized = ratePlansArray.map((item, index) => {
    const mealPlanName = normalizeMealPlanName(item.mealPlanName || item.name || item.meal_plan_name || item.key);
    if (!mealPlanName) {
      throw new ApiError(400, 'Each rate plan must have a mealPlanName');
    }

    if (seenNames.has(mealPlanName)) {
      throw new ApiError(400, 'Rate plan names must be unique');
    }
    seenNames.add(mealPlanName);

    const extraBedPrice = item.extraBedPrice !== undefined ? Number(item.extraBedPrice) : undefined;
    const childPrice = item.childPrice !== undefined ? Number(item.childPrice) : undefined;
    const isDefault = Boolean(item.isDefault);

    if (extraBedPrice !== undefined && extraBedPrice < 0) {
      throw new ApiError(400, 'extraBedPrice must be greater than or equal to 0');
    }

    if (childPrice !== undefined && childPrice < 0) {
      throw new ApiError(400, 'childPrice must be greater than or equal to 0');
    }

    const current = currentRatePlans.find((ratePlan) => normalizeMealPlanName(ratePlan.mealPlanName) === mealPlanName) || null;

    return {
      id: current?.id,
      mealPlanName,
      extraBedPrice,
      childPrice,
      isDefault,
      order: index,
    };
  });

  if (!normalized.some((ratePlan) => ratePlan.isDefault)) {
    normalized[0].isDefault = true;
  }

  return normalized;
};

const withRatePlans = (roomType) => ({
  ...roomType,
  ratePlans: (roomType.ratePlans || [])
    .map((ratePlan) => ({
      ...ratePlan,
      mealPlanName: normalizeMealPlanName(ratePlan.mealPlanName),
    }))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.mealPlanName.localeCompare(right.mealPlanName)),
});

const normalizeRoomPayload = (payload, current = null) => {
  const baseCapacity = toNumberOrUndefined(payload.baseCapacity ?? payload.base_capacity) ?? current?.baseCapacity;
  const maxCapacity =
    toNumberOrUndefined(payload.maxCapacity ?? payload.max_capacity) ??
    toNumberOrUndefined(payload.maxOccupancy) ??
    current?.maxCapacity ??
    current?.maxOccupancy;
  const basePrice = toNumberOrUndefined(payload.basePrice ?? payload.base_price) ?? current?.basePrice ?? 0;
  const extraPersonPrice =
    toNumberOrUndefined(payload.extraPersonPrice ?? payload.extra_person_price) ?? current?.extraPersonPrice ?? 0;
  const baseInventory =
    toNumberOrUndefined(payload.baseInventory ?? payload.base_inventory) ?? current?.baseInventory ?? 1;

  if (baseCapacity === undefined || maxCapacity === undefined) {
    throw new ApiError(400, 'baseCapacity and maxCapacity are required');
  }

  if (baseCapacity < 1) {
    throw new ApiError(400, 'baseCapacity must be greater than or equal to 1');
  }

  if (maxCapacity < baseCapacity) {
    throw new ApiError(400, 'maxCapacity must be greater than or equal to baseCapacity');
  }

  if (extraPersonPrice < 0) {
    throw new ApiError(400, 'extraPersonPrice must be greater than or equal to 0');
  }

  if (basePrice < 0) {
    throw new ApiError(400, 'basePrice must be greater than or equal to 0');
  }

  if (baseInventory < 0) {
    throw new ApiError(400, 'baseInventory must be greater than or equal to 0');
  }

  return {
    basePrice,
    extraPersonPrice,
    baseCapacity,
    maxCapacity,
    baseInventory,
    maxOccupancy: maxCapacity,
  };
};

const buildRoomCreateData = (payload, ratePlans, basePrice) => ({
  propertyId: payload.propertyId,
  name: payload.name,
  basePrice,
  ...(({ basePrice: _ignoredBasePrice, ...rest }) => normalizeRoomPayload(payload))(payload),
});

const createRoomPlans = async (tx, roomTypeId, ratePlans) => {
  if (!Array.isArray(ratePlans) || ratePlans.length === 0) {
    return [];
  }

  await tx.ratePlan.createMany({
    data: ratePlans.map((ratePlan) => ({
      roomTypeId,
      mealPlanName: ratePlan.mealPlanName,
      extraBedPrice: ratePlan.extraBedPrice ?? null,
      childPrice: ratePlan.childPrice ?? null,
      isDefault: Boolean(ratePlan.isDefault),
    })),
  });

  return tx.ratePlan.findMany({
    where: { roomTypeId },
    orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
  });
};

const replaceRoomPlans = async (tx, roomTypeId, ratePlans) => {
  if (!Array.isArray(ratePlans)) {
    return [];
  }

  await tx.ratePlan.deleteMany({ where: { roomTypeId } });
  return createRoomPlans(tx, roomTypeId, ratePlans);
};

const seedRoomPricingForDateRange = async ({ tx, roomTypeId, ratePlans, startDate, endDate, fallbackPrice }) => {
  if (!Array.isArray(ratePlans) || ratePlans.length === 0) {
    return;
  }

  const dates = enumerateDatesInclusive(startDate, endDate);
  const existing = await tx.roomPricing.findMany({
    where: {
      roomTypeId,
      date: {
        gte: dates[0],
        lte: dates[dates.length - 1],
      },
    },
    select: {
      ratePlanId: true,
      date: true,
    },
  });

  const existingSet = new Set(existing.map((item) => `${item.ratePlanId}:${item.date.toISOString()}`));
  const rows = [];
  for (const date of dates) {
    for (const plan of ratePlans) {
      const key = `${plan.id}:${date.toISOString()}`;
      if (existingSet.has(key)) {
        continue;
      }
      rows.push({
        roomTypeId,
        ratePlanId: plan.id,
        date,
        price: Number(fallbackPrice ?? 0),
      });
    }
  }

  if (rows.length > 0) {
    await tx.roomPricing.createMany({ data: rows });
  }
};

const applyOperation = (currentValue, operation, delta) => {
  if (operation === 'set') {
    return delta;
  }

  if (operation === 'increase') {
    return currentValue + delta;
  }

  if (operation === 'decrease') {
    return currentValue - delta;
  }

  throw new ApiError(400, 'Invalid bulk operation');
};

const applyOperationStrict = (currentValue, operation, delta, type) => {
  const nextValue = applyOperation(currentValue, operation, delta);
  if (nextValue < 0) {
    throw new ApiError(400, `${type} cannot be reduced below 0`);
  }
  return nextValue;
};

const createRoomType = async (payload, user) => {
  const property = await prisma.property.findUnique({ where: { id: payload.propertyId } });
  assertPropertyMutationAccess(property, user, 'canManageRooms');

  const normalizedRatePlans = normalizeRatePlans(payload.ratePlans);
  const fallbackBasePrice = Number(payload.basePrice ?? payload.base_price ?? 0);
  const createData = buildRoomCreateData(payload, normalizedRatePlans, fallbackBasePrice);

  if (!normalizedRatePlans) {
    return prisma.roomType.create({
      data: createData,
    });
  }

  return prisma.$transaction(async (tx) => {
    const roomType = await tx.roomType.create({
      data: createData,
    });

    const createdPlans = await createRoomPlans(tx, roomType.id, normalizedRatePlans);
    const today = new Date();
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 365);
    await seedRoomPricingForDateRange({
      tx,
      roomTypeId: roomType.id,
      ratePlans: createdPlans,
      startDate,
      endDate,
      fallbackPrice: roomType.basePrice ?? fallbackBasePrice,
    });

    return tx.roomType.findUnique({
      where: { id: roomType.id },
      include: {
        property: { select: { id: true, name: true } },
        ratePlans: { orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }] },
      },
    });
  });
};

const listRoomTypes = async (propertyId, user) => {
  if (propertyId) {
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    assertPropertyAccess(property, user);
  }

  const where =
    user.role === 'ADMIN'
      ? propertyId
        ? { propertyId }
        : {}
      : propertyId
        ? { propertyId }
        : { property: { propertyManagers: { some: { userId: user.id } } } };

  return prisma.roomType.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      property: {
        select: { id: true, name: true },
      },
      ratePlans: {
        orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
      },
    },
  }).then((roomTypes) => roomTypes.map((roomType) => withRatePlans(roomType)));
};

const updateRoomType = async (id, payload, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id },
    include: { property: true, ratePlans: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyMutationAccess(roomType.property, user, 'canManageRooms');

  const normalized = normalizeRoomPayload(payload, roomType);
  const normalizedRatePlans = normalizeRatePlans(payload.ratePlans, roomType.ratePlans || []);

  if (!normalizedRatePlans) {
    return prisma.roomType.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...normalized,
      },
      include: {
        property: { select: { id: true, name: true } },
        ratePlans: { orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }] },
      },
    }).then((updated) => withRatePlans(updated));
  }

  return prisma.$transaction(async (tx) => {
    const updatedRoomType = await tx.roomType.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...normalized,
      },
    });

    const updatedPlans = await replaceRoomPlans(tx, id, normalizedRatePlans);
    const today = new Date();
    const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 365);
    await seedRoomPricingForDateRange({
      tx,
      roomTypeId: id,
      ratePlans: updatedPlans,
      startDate,
      endDate,
      fallbackPrice: updatedRoomType.basePrice ?? normalized.basePrice,
    });

    return tx.roomType.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        ratePlans: { orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }] },
      },
    }).then((updated) => withRatePlans(updated));
  });
};

const deleteRoomType = async (id, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyMutationAccess(roomType.property, user, 'canManageRooms');

  await prisma.roomType.delete({ where: { id } });
  return { id };
};

const bulkUpdateRoomType = async (payload, user) => {
  const roomTypeId = payload.roomTypeId || payload.room_id;
  const type = payload.type;
  const operation = payload.operation;
  const deltaValue = Number(payload.value);
  const ratePlanId = payload.ratePlanId || payload.rate_plan_id || null;
  const applyToAll = Boolean(payload.applyToAll || payload.apply_to_all || String(ratePlanId || '').toUpperCase() === 'ALL');

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { property: true, ratePlans: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  const startDate = payload.startDate || payload.start_date;
  const endDate = payload.endDate || payload.end_date;

  if (!['price', 'inventory'].includes(type)) {
    throw new ApiError(400, 'type must be price or inventory');
  }

  if (!['increase', 'decrease', 'set'].includes(operation)) {
    throw new ApiError(400, 'operation must be increase, decrease, or set');
  }

  if (deltaValue < 0) {
    throw new ApiError(400, 'value must be greater than or equal to 0');
  }

  assertPropertyMutationAccess(roomType.property, user, type === 'price' ? 'canManagePricing' : 'canManageInventory');

  const dates = enumerateDatesInclusive(startDate, endDate);
  return prisma.$transaction(async (tx) => {
    const updates = [];
    const targetRatePlans = applyToAll
      ? roomType.ratePlans
      : roomType.ratePlans.filter((ratePlan) => ratePlan.id === ratePlanId);

    if (type === 'price' && targetRatePlans.length === 0) {
      throw new ApiError(400, 'Select a valid rate plan or choose ALL');
    }

    for (const date of dates) {
      if (type === 'price') {
        for (const ratePlan of targetRatePlans) {
          const existingPricing = await tx.roomPricing.findUnique({
            where: {
              roomTypeId_ratePlanId_date: {
                roomTypeId,
                ratePlanId: ratePlan.id,
                date,
              },
            },
            select: { price: true },
          });

          const currentValue = Number(existingPricing?.price ?? roomType.basePrice ?? 0);
          const nextValue = applyOperationStrict(currentValue, operation, deltaValue, 'price');

          const updated = await tx.roomPricing.upsert({
            where: {
              roomTypeId_ratePlanId_date: {
                roomTypeId,
                ratePlanId: ratePlan.id,
                date,
              },
            },
            create: {
              roomTypeId,
              ratePlanId: ratePlan.id,
              date,
              price: nextValue,
            },
            update: { price: nextValue },
          });

          updates.push(updated);
        }
      } else {
        const existingInventory = await tx.inventory.findUnique({
          where: { roomTypeId_date: { roomTypeId, date } },
          select: { availableRooms: true },
        });

        const currentValue = Number(existingInventory?.availableRooms ?? roomType.baseInventory ?? 0);
        const nextValue = applyOperationStrict(currentValue, operation, deltaValue, 'inventory');

        const updated = await tx.inventory.upsert({
          where: { roomTypeId_date: { roomTypeId, date } },
          create: { roomTypeId, date, availableRooms: nextValue },
          update: { availableRooms: nextValue },
        });

        updates.push(updated);
      }
    }

    return {
      roomTypeId,
      type,
      operation,
      ratePlanId: applyToAll ? 'ALL' : ratePlanId,
      updatedCount: updates.length,
      entries: updates,
    };
  });
};

module.exports = {
  createRoomType,
  listRoomTypes,
  updateRoomType,
  deleteRoomType,
  bulkUpdateRoomType,
};
