const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

const getFromCache = (key) => {
  const item = cache.get(key);
  if (!item) {
    return null;
  }

  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }

  return item.value;
};

const setCache = (key, value) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

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

const formatDateKey = (date) => date.toISOString().split('T')[0];

const getRevenueAnalytics = async ({ startDate, endDate }) => {
  const cacheKey = `revenue:${startDate}:${endDate}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const from = normalizeToUtcDate(startDate);
  const to = normalizeToUtcDate(endDate);
  if (to < from) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      checkIn: { lte: to },
      checkOut: { gt: from },
    },
    select: {
      checkIn: true,
      checkOut: true,
      totalPrice: true,
    },
  });

  const revenueMap = {};
  let totalRevenue = 0;

  bookings.forEach((booking) => {
    const stayDates = enumerateDatesExclusive(booking.checkIn, booking.checkOut);
    const perDay = stayDates.length > 0 ? Number(booking.totalPrice || 0) / stayDates.length : 0;
    stayDates.forEach((date) => {
      if (date < from || date > to) {
        return;
      }
      const key = formatDateKey(date);
      revenueMap[key] = (revenueMap[key] || 0) + perDay;
      totalRevenue += perDay;
    });
  });

  const revenuePerDay = Object.entries(revenueMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }));

  const result = {
    totalRevenue: Number(totalRevenue.toFixed(2)),
    revenuePerDay,
  };

  setCache(cacheKey, result);
  return result;
};

const getOccupancyAnalytics = async ({ roomTypeId, startDate, endDate }) => {
  const cacheKey = `occupancy:${roomTypeId || 'all'}:${startDate}:${endDate}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const from = normalizeToUtcDate(startDate);
  const to = normalizeToUtcDate(endDate);
  if (to < from) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      ...(roomTypeId ? { roomTypeId } : {}),
      date: {
        gte: from,
        lte: to,
      },
    },
    select: {
      roomTypeId: true,
      date: true,
      availableRooms: true,
    },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      ...(roomTypeId ? { roomTypeId } : {}),
      checkIn: { lte: to },
      checkOut: { gt: from },
    },
    select: {
      roomTypeId: true,
      checkIn: true,
      checkOut: true,
    },
  });

  const bookedMap = {};
  bookings.forEach((booking) => {
    const dates = enumerateDatesExclusive(booking.checkIn, booking.checkOut);
    dates.forEach((date) => {
      if (date < from || date > to) {
        return;
      }
      const key = `${booking.roomTypeId}:${formatDateKey(date)}`;
      bookedMap[key] = (bookedMap[key] || 0) + 1;
    });
  });

  let bookedRooms = 0;
  let totalAvailableRooms = 0;
  const perDayMap = {};

  inventoryRows.forEach((row) => {
    const dateKey = formatDateKey(row.date);
    const compositeKey = `${row.roomTypeId}:${dateKey}`;
    const booked = bookedMap[compositeKey] || 0;
    const total = booked + row.availableRooms;

    bookedRooms += booked;
    totalAvailableRooms += total;

    if (!perDayMap[dateKey]) {
      perDayMap[dateKey] = { date: dateKey, bookedRooms: 0, totalAvailableRooms: 0, occupancy: 0 };
    }

    perDayMap[dateKey].bookedRooms += booked;
    perDayMap[dateKey].totalAvailableRooms += total;
  });

  const occupancyRate = totalAvailableRooms === 0 ? 0 : Number(((bookedRooms / totalAvailableRooms) * 100).toFixed(2));

  const perDay = Object.values(perDayMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({
      ...item,
      occupancy:
        item.totalAvailableRooms === 0
          ? 0
          : Number(((item.bookedRooms / item.totalAvailableRooms) * 100).toFixed(2)),
    }));

  const result = {
    bookedRooms,
    totalAvailableRooms,
    occupancyRate,
    perDay,
  };

  setCache(cacheKey, result);
  return result;
};

const getOtaPerformance = async () => {
  const cacheKey = 'ota-performance';
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const grouped = await prisma.booking.groupBy({
    by: ['otaSource'],
    where: {
      status: 'CONFIRMED',
    },
    _count: {
      _all: true,
    },
    _sum: {
      totalPrice: true,
    },
  });

  const performance = grouped.map((item) => ({
    otaSource: item.otaSource,
    bookings: item._count._all,
    revenue: Number((item._sum.totalPrice || 0).toFixed(2)),
  }));

  const result = {
    performance,
  };

  setCache(cacheKey, result);
  return result;
};

const getKeyMetrics = async ({ startDate, endDate }) => {
  const cacheKey = `metrics:${startDate || 'all'}:${endDate || 'all'}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const bookingWhere = {
    status: 'CONFIRMED',
  };

  if (startDate || endDate) {
    const from = startDate ? normalizeToUtcDate(startDate) : null;
    const to = endDate ? normalizeToUtcDate(endDate) : null;

    if (from && to && to < from) {
      throw new ApiError(400, 'endDate must be on or after startDate');
    }

    bookingWhere.AND = [
      ...(from ? [{ checkOut: { gt: from } }] : []),
      ...(to ? [{ checkIn: { lte: to } }] : []),
    ];
  }

  const [bookings, inventories] = await Promise.all([
    prisma.booking.findMany({
      where: bookingWhere,
      select: {
        totalPrice: true,
        checkIn: true,
        checkOut: true,
        roomTypeId: true,
      },
    }),
    prisma.inventory.findMany({
      where: {
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: normalizeToUtcDate(startDate) } : {}),
                ...(endDate ? { lte: normalizeToUtcDate(endDate) } : {}),
              },
            }
          : {}),
      },
      select: {
        roomTypeId: true,
        date: true,
        availableRooms: true,
      },
    }),
  ]);

  const bookedMap = {};
  let totalRevenue = 0;

  bookings.forEach((booking) => {
    totalRevenue += Number(booking.totalPrice || 0);
    const dates = enumerateDatesExclusive(booking.checkIn, booking.checkOut);
    dates.forEach((date) => {
      if (startDate && date < normalizeToUtcDate(startDate)) {
        return;
      }
      if (endDate && date > normalizeToUtcDate(endDate)) {
        return;
      }
      const key = `${booking.roomTypeId}:${formatDateKey(date)}`;
      bookedMap[key] = (bookedMap[key] || 0) + 1;
    });
  });

  let totalAvailableRooms = 0;
  let bookedRooms = 0;

  inventories.forEach((row) => {
    const key = `${row.roomTypeId}:${formatDateKey(row.date)}`;
    const booked = bookedMap[key] || 0;
    bookedRooms += booked;
    totalAvailableRooms += booked + row.availableRooms;
  });

  const totalBookings = bookings.length;
  const adr = totalBookings === 0 ? 0 : Number((totalRevenue / totalBookings).toFixed(2));
  const revpar = totalAvailableRooms === 0 ? 0 : Number((totalRevenue / totalAvailableRooms).toFixed(2));
  const occupancyRate = totalAvailableRooms === 0 ? 0 : Number(((bookedRooms / totalAvailableRooms) * 100).toFixed(2));

  const result = {
    ADR: adr,
    RevPAR: revpar,
    occupancyRate,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalBookings,
    totalAvailableRooms,
  };

  setCache(cacheKey, result);
  return result;
};

module.exports = {
  getRevenueAnalytics,
  getOccupancyAnalytics,
  getOtaPerformance,
  getKeyMetrics,
};
