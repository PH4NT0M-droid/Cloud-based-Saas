const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const otaService = require('./ota/otaService');
const { reduceInventory, restoreInventory } = require('./inventoryService');
const notificationService = require('./notificationService');
const { assertPropertyAccess } = require('./accessControl');

const normalizeToUtcDate = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const enumerateDatesExclusive = (startDateInput, endDateInput) => {
  const startDate = normalizeToUtcDate(startDateInput);
  const endDate = normalizeToUtcDate(endDateInput);

  if (endDate <= startDate) {
    throw new ApiError(400, 'checkOut must be after checkIn');
  }

  const dates = [];
  const current = new Date(startDate);
  while (current < endDate) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};

const computeDynamicBasePrice = (basePrice, roomTypeMaxOccupancy, availableRooms) => {
  if (availableRooms === null || availableRooms === undefined) {
    return basePrice;
  }

  if (!roomTypeMaxOccupancy || roomTypeMaxOccupancy <= 0) {
    return basePrice;
  }

  const occupancyRatio = Math.max(0, Math.min(1, (roomTypeMaxOccupancy - availableRooms) / roomTypeMaxOccupancy));
  const occupancyPercent = occupancyRatio * 100;

  if (occupancyPercent > 80) {
    return basePrice * 1.2;
  }

  if (occupancyPercent < 30) {
    return basePrice * 0.9;
  }

  return basePrice;
};

const formatDateKey = (date) => date.toISOString().split('T')[0];

const calculateTotalPrice = async (roomTypeId, checkIn, checkOut, tx) => {
  const dates = enumerateDatesExclusive(checkIn, checkOut);
  if (dates.length === 0) {
    return 0;
  }

  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];

  const [roomType, rates, inventories] = await Promise.all([
    tx.roomType.findUnique({
      where: { id: roomTypeId },
      select: { id: true, maxOccupancy: true },
    }),
    tx.rate.findMany({
      where: {
        roomTypeId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        date: true,
        basePrice: true,
        otaModifier: true,
      },
    }),
    tx.inventory.findMany({
      where: {
        roomTypeId,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        date: true,
        availableRooms: true,
      },
    }),
  ]);

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  const ratesByDate = rates.reduce((acc, rate) => {
    acc[formatDateKey(rate.date)] = rate;
    return acc;
  }, {});

  const inventoryByDate = inventories.reduce((acc, inventory) => {
    acc[formatDateKey(inventory.date)] = inventory.availableRooms;
    return acc;
  }, {});

  const total = dates.reduce((sum, date) => {
    const key = formatDateKey(date);
    const rate = ratesByDate[key];
    if (!rate) {
      return sum;
    }

    const dynamicBasePrice = computeDynamicBasePrice(
      rate.basePrice,
      roomType.maxOccupancy,
      inventoryByDate[key],
    );

    return sum + dynamicBasePrice * rate.otaModifier;
  }, 0);

  return Math.round((total + Number.EPSILON) * 100) / 100;
};

const canMutateBooking = (booking, user) => {
  try {
    assertPropertyAccess(booking.roomType.property, user);
    return true;
  } catch (error) {
    return false;
  }
};

const listBookings = async (user, filters) => {
  const where = {};

  if (filters.otaSource) {
    where.otaSource = filters.otaSource;
  }

  if (filters.roomTypeId) {
    where.roomTypeId = filters.roomTypeId;
  }

  if (filters.startDate || filters.endDate) {
    const startDate = filters.startDate ? normalizeToUtcDate(filters.startDate) : null;
    const endDate = filters.endDate ? normalizeToUtcDate(filters.endDate) : null;

    if (startDate && endDate && endDate < startDate) {
      throw new ApiError(400, 'endDate must be on or after startDate');
    }

    where.AND = [
      ...(startDate ? [{ checkOut: { gt: startDate } }] : []),
      ...(endDate ? [{ checkIn: { lte: endDate } }] : []),
    ];
  }

  return prisma.booking.findMany({
    where:
      user?.role === 'ADMIN'
        ? where
        : { ...where, roomType: { property: { propertyManagers: { some: { userId: user.id } } } } },
    include: {
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getBookingById = async (id, user) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  assertPropertyAccess(booking.roomType.property, user, 'You are not authorized to access this booking');

  return booking;
};

const updateBookingStatus = async (id, status, user) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (!canMutateBooking(booking, user)) {
    throw new ApiError(403, 'You are not authorized to update this booking');
  }

  if (booking.status === status) {
    return booking;
  }

  return prisma.$transaction(async (tx) => {
    if (status === 'CONFIRMED' && booking.status === 'CANCELLED') {
      await reduceInventory(booking.roomTypeId, booking.checkIn, booking.checkOut, tx);
    }

    if (status === 'CANCELLED' && booking.status === 'CONFIRMED') {
      await restoreInventory(booking.roomTypeId, booking.checkIn, booking.checkOut, tx);

      await notificationService.notify({
        type: 'BOOKING_CANCELLED',
        message: `Booking ${booking.id} cancelled and inventory restored for roomType ${booking.roomTypeId}`,
      });
    }

    if (status === 'CONFIRMED' && booking.status === 'CANCELLED') {
      await notificationService.notify({
        type: 'BOOKING_CONFIRMED',
        message: `Booking ${booking.id} reconfirmed and inventory reduced for roomType ${booking.roomTypeId}`,
      });
    }

    return tx.booking.update({
      where: { id },
      data: { status },
    });
  });
};

const normalizeOtaBooking = (booking) => ({
  otaSource: booking.ota,
  roomTypeId: booking.roomTypeId,
  checkIn: normalizeToUtcDate(booking.checkIn),
  checkOut: normalizeToUtcDate(booking.checkOut),
  guestName: booking.guestName,
  status: booking.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
});

const syncBookingsFromOtas = async (otas, user) => {
  if (user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only administrators can sync OTA bookings');
  }

  const otaResult = await otaService.fetchAllBookings(otas, user);
  const incoming = otaResult.bookings.map(normalizeOtaBooking);

  const summary = {
    synced: otaResult.failedOtas.length === 0,
    totalFetched: incoming.length,
    created: 0,
    duplicates: 0,
    failed: 0,
    failedItems: [],
    processedBookingIds: [],
    failedOtas: otaResult.failedOtas,
  };

  for (const booking of incoming) {
    try {
      if (booking.checkOut <= booking.checkIn) {
        throw new ApiError(400, 'checkOut must be after checkIn');
      }

      const existing = await prisma.booking.findUnique({
        where: {
          otaSource_roomTypeId_checkIn_guestName: {
            otaSource: booking.otaSource,
            roomTypeId: booking.roomTypeId,
            checkIn: booking.checkIn,
            guestName: booking.guestName,
          },
        },
      });

      if (existing) {
        summary.duplicates += 1;
        continue;
      }

      const created = await prisma.$transaction(async (tx) => {
        const totalPrice = await calculateTotalPrice(booking.roomTypeId, booking.checkIn, booking.checkOut, tx);

        if (booking.status === 'CONFIRMED') {
          await reduceInventory(booking.roomTypeId, booking.checkIn, booking.checkOut, tx);
        }

        return tx.booking.create({
          data: {
            otaSource: booking.otaSource,
            roomTypeId: booking.roomTypeId,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            guestName: booking.guestName,
            status: booking.status,
            totalPrice,
          },
        });
      });

      summary.created += 1;
      summary.processedBookingIds.push(created.id);

      await notificationService.notify({
        type: 'NEW_BOOKING',
        message: `New booking received from ${booking.otaSource} for roomType ${booking.roomTypeId}`,
      });
    } catch (error) {
      summary.failed += 1;
      summary.failedItems.push({
        otaSource: booking.otaSource,
        roomTypeId: booking.roomTypeId,
        guestName: booking.guestName,
        message: error.message,
      });
    }
  }

  return summary;
};

module.exports = {
  listBookings,
  getBookingById,
  updateBookingStatus,
  syncBookingsFromOtas,
};
