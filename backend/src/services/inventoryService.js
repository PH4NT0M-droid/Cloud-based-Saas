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

const enumerateDatesExclusive = (startDateInput, endDateInput) => {
  const startDate = normalizeToUtcDate(startDateInput);
  const endDate = normalizeToUtcDate(endDateInput);

  if (endDate <= startDate) {
    throw new ApiError(400, 'endDate must be after startDate');
  }

  const dates = [];
  const current = new Date(startDate);
  while (current < endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

const updateInventory = async (payload, user, txClient) => {
  const db = txClient || prisma;
  const roomType = await db.roomType.findUnique({
    where: { id: payload.roomTypeId },
    include: { property: true },
  });

  assertRoomTypeAccess(roomType, user, 'canManageInventory');

  const date = normalizeToUtcDate(payload.date);
  const availableRooms = Number(payload.availableRooms);

  if (availableRooms < 0) {
    throw new ApiError(400, 'availableRooms cannot be negative');
  }

  return db.inventory.upsert({
    where: {
      roomTypeId_date: {
        roomTypeId: payload.roomTypeId,
        date,
      },
    },
    create: {
      roomTypeId: payload.roomTypeId,
      date,
      availableRooms,
    },
    update: {
      availableRooms,
    },
  });
};

const bulkUpdateInventory = async (payload, user, txClient) => {
  const db = txClient || prisma;
  const roomType = await db.roomType.findUnique({
    where: { id: payload.roomTypeId },
    include: { property: true },
  });

  assertRoomTypeAccess(roomType, user, 'canManageInventory');

  const availableRooms = Number(payload.availableRooms);
  if (availableRooms < 0) {
    throw new ApiError(400, 'availableRooms cannot be negative');
  }

  const dates = enumerateDatesInclusive(payload.startDate, payload.endDate);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const data = dates.map((date) => ({
    roomTypeId: payload.roomTypeId,
    date,
    availableRooms,
  }));

  return db.$transaction(async (tx) => {
    await tx.inventory.deleteMany({
      where: {
        roomTypeId: payload.roomTypeId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (data.length > 0) {
      await tx.inventory.createMany({ data });
    }

    const entries = await tx.inventory.findMany({
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
      entries,
    };
  });
};

const getInventoryCalendar = async ({ roomTypeId, startDate, endDate }, user) => {
  const normalizedStartDate = normalizeToUtcDate(startDate);
  const normalizedEndDate = normalizeToUtcDate(endDate);

  if (normalizedEndDate < normalizedStartDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: { property: true },
  });

  assertRoomTypeAccess(roomType, user, 'canManageInventory');

  const entries = await prisma.inventory.findMany({
    where: {
      roomTypeId,
      date: {
        gte: normalizedStartDate,
        lte: normalizedEndDate,
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  const groupedByDate = entries.reduce((acc, item) => {
    const key = item.date.toISOString().split('T')[0];
    acc[key] = {
      availableRooms: item.availableRooms,
      id: item.id,
    };
    return acc;
  }, {});

  return {
    roomTypeId,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    entries,
    groupedByDate,
  };
};

const reduceInventory = async (roomTypeId, startDate, endDate, txClient) => {
  const db = txClient || prisma;
  const dates = enumerateDatesExclusive(startDate, endDate);
  const rangeStart = dates[0];
  const rangeEnd = new Date(dates[dates.length - 1]);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  return db.$transaction(async (tx) => {
    const totalDaysConfigured = await tx.inventory.count({
      where: {
        roomTypeId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
    });

    if (totalDaysConfigured !== dates.length) {
      throw new ApiError(409, 'Inventory is not configured for all requested dates');
    }

    const updated = await tx.inventory.updateMany({
      where: {
        roomTypeId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
        availableRooms: {
          gt: 0,
        },
      },
      data: {
        availableRooms: {
          decrement: 1,
        },
      },
    });

    if (updated.count !== dates.length) {
      throw new ApiError(409, 'Insufficient inventory for one or more dates');
    }

    return {
      roomTypeId,
      reducedDays: updated.count,
    };
  });
};

const restoreInventory = async (roomTypeId, startDate, endDate, txClient) => {
  const db = txClient || prisma;
  const dates = enumerateDatesExclusive(startDate, endDate);
  const rangeStart = dates[0];
  const rangeEnd = new Date(dates[dates.length - 1]);
  rangeEnd.setUTCHours(23, 59, 59, 999);

  return db.$transaction(async (tx) => {
    await tx.inventory.updateMany({
      where: {
        roomTypeId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      data: {
        availableRooms: {
          increment: 1,
        },
      },
    });

    const existing = await tx.inventory.findMany({
      where: {
        roomTypeId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        date: true,
      },
    });

    const existingKeys = new Set(existing.map((item) => item.date.toISOString().split('T')[0]));
    const missing = dates
      .filter((date) => !existingKeys.has(date.toISOString().split('T')[0]))
      .map((date) => ({
        roomTypeId,
        date,
        availableRooms: 1,
      }));

    if (missing.length > 0) {
      await tx.inventory.createMany({ data: missing });
    }

    return {
      roomTypeId,
      restoredDays: dates.length,
    };
  });
};

module.exports = {
  updateInventory,
  bulkUpdateInventory,
  getInventoryCalendar,
  reduceInventory,
  restoreInventory,
};
