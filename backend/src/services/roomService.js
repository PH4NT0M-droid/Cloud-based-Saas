const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const { assertPropertyAccess, assertPropertyMutationAccess } = require('./accessControl');
const { enumerateDatesInclusive } = require('./dateService');

const toNumberOrUndefined = (value) => (value === undefined ? undefined : Number(value));

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

  return prisma.roomType.create({
    data: {
      propertyId: payload.propertyId,
      name: payload.name,
      ...normalizeRoomPayload(payload),
    },
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
    },
  });
};

const updateRoomType = async (id, payload, user) => {
  const roomType = await prisma.roomType.findUnique({
    where: { id },
    include: { property: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyMutationAccess(roomType.property, user, 'canManageRooms');

  const normalized = normalizeRoomPayload(payload, roomType);

  return prisma.roomType.update({
    where: { id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...normalized,
    },
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
  const startDate = payload.startDate || payload.start_date;
  const endDate = payload.endDate || payload.end_date;
  const type = payload.type;
  const operation = payload.operation;
  const deltaValue = Number(payload.value);

  if (!['price', 'inventory'].includes(type)) {
    throw new ApiError(400, 'type must be price or inventory');
  }

  if (!['increase', 'decrease', 'set'].includes(operation)) {
    throw new ApiError(400, 'operation must be increase, decrease, or set');
  }

  if (deltaValue < 0) {
    throw new ApiError(400, 'value must be greater than or equal to 0');
  }

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { property: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyMutationAccess(roomType.property, user, type === 'price' ? 'canManagePricing' : 'canManageInventory');

  const dates = enumerateDatesInclusive(startDate, endDate);
  return prisma.$transaction(async (tx) => {
    const updates = [];

    for (const date of dates) {
      if (type === 'price') {
        const existingRate = await tx.rate.findUnique({
          where: { roomTypeId_date: { roomTypeId, date } },
          select: { basePrice: true, otaModifier: true },
        });

        const currentValue = Number(existingRate?.basePrice ?? roomType.basePrice ?? 0);
        const nextValue = applyOperationStrict(currentValue, operation, deltaValue, 'price');

        const updated = await tx.rate.upsert({
          where: { roomTypeId_date: { roomTypeId, date } },
          create: { roomTypeId, date, basePrice: nextValue, otaModifier: 1.0 },
          update: { basePrice: nextValue },
        });

        updates.push(updated);
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
