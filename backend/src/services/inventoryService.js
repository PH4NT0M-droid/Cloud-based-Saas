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

const supportsTransaction = (db) => typeof db?.$transaction === 'function';

const getRoomTypeBaseInventory = async (tx, roomTypeId) => {
  const roomType = await tx.roomType.findUnique({
    where: { id: roomTypeId },
    select: { id: true, baseInventory: true },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  return Number(roomType.baseInventory ?? 0);
};

const reduceInventoryInTransaction = async (tx, roomTypeId, startDate, endDate) => {
  const dates = enumerateDatesExclusive(startDate, endDate);
  const baseInventory = await getRoomTypeBaseInventory(tx, roomTypeId);

  for (const date of dates) {
    const existing = await tx.inventory.findUnique({
      where: {
        roomTypeId_date: {
          roomTypeId,
          date,
        },
      },
      select: { id: true, availableRooms: true },
    });

    const availableRooms = existing ? Number(existing.availableRooms) : baseInventory;
    if (availableRooms <= 0) {
      throw new ApiError(409, 'Insufficient inventory for one or more dates');
    }

    await tx.inventory.upsert({
      where: {
        roomTypeId_date: {
          roomTypeId,
          date,
        },
      },
      create: {
        roomTypeId,
        date,
        availableRooms: availableRooms - 1,
      },
      update: {
        availableRooms: availableRooms - 1,
      },
    });
  }

  return {
    roomTypeId,
    reducedDays: dates.length,
  };
};

const restoreInventoryInTransaction = async (tx, roomTypeId, startDate, endDate) => {
  const dates = enumerateDatesExclusive(startDate, endDate);
  const baseInventory = await getRoomTypeBaseInventory(tx, roomTypeId);

  for (const date of dates) {
    const existing = await tx.inventory.findUnique({
      where: {
        roomTypeId_date: {
          roomTypeId,
          date,
        },
      },
      select: { id: true, availableRooms: true },
    });

    const availableRooms = existing ? Number(existing.availableRooms) : baseInventory;

    await tx.inventory.upsert({
      where: {
        roomTypeId_date: {
          roomTypeId,
          date,
        },
      },
      create: {
        roomTypeId,
        date,
        availableRooms: availableRooms + 1,
      },
      update: {
        availableRooms: availableRooms + 1,
      },
    });
  }

  return {
    roomTypeId,
    restoredDays: dates.length,
  };
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
  if (supportsTransaction(db)) {
    return db.$transaction((tx) => reduceInventoryInTransaction(tx, roomTypeId, startDate, endDate));
  }

  return reduceInventoryInTransaction(db, roomTypeId, startDate, endDate);
};

const restoreInventory = async (roomTypeId, startDate, endDate, txClient) => {
  const db = txClient || prisma;
  if (supportsTransaction(db)) {
    return db.$transaction((tx) => restoreInventoryInTransaction(tx, roomTypeId, startDate, endDate));
  }

  return restoreInventoryInTransaction(db, roomTypeId, startDate, endDate);
};

module.exports = {
  updateInventory,
  bulkUpdateInventory,
  getInventoryCalendar,
  reduceInventory,
  restoreInventory,
};
