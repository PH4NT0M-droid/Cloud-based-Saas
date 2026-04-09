const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const notificationService = require('../notificationService');
const BookingAdapter = require('./bookingAdapter');
const AirbnbAdapter = require('./airbnbAdapter');
const MakeMyTripAdapter = require('./makemytripAdapter');
const AgodaAdapter = require('./agodaAdapter');
const { assertPropertyAccess } = require('../accessControl');

const adapterRegistry = {
  booking: new BookingAdapter(),
  airbnb: new AirbnbAdapter(),
  makemytrip: new MakeMyTripAdapter(),
  agoda: new AgodaAdapter(),
};

const failedSyncJobs = [];

const normalizeToUtcDate = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const resolveOtas = (otas) => {
  const all = Object.keys(adapterRegistry);
  if (!otas || otas.length === 0) {
    return all;
  }

  const invalid = otas.filter((ota) => !adapterRegistry[ota]);
  if (invalid.length > 0) {
    throw new ApiError(400, `Unsupported OTA(s): ${invalid.join(', ')}`);
  }

  return [...new Set(otas)];
};

const executeWithRetry = async (operationFn, options = {}) => {
  const retries = options.retries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 80;
  const operationName = options.operationName || 'operation';
  const ota = options.ota || 'unknown';

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await operationFn();
    } catch (error) {
      lastError = error;
      const hasNextRetry = attempt < retries;
      console.error(`[OTA:${ota}] ${operationName} failed on attempt ${attempt + 1}: ${error.message}`);

      if (!hasNextRetry) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      attempt += 1;
    }
  }

  throw lastError;
};

const runAdapterOperation = async (otas, operation, payload) => {
  const tasks = otas.map(async (ota) => {
    const adapter = adapterRegistry[ota];
    const response = await executeWithRetry(() => adapter[operation](payload), {
      retries: 3,
      retryDelayMs: 80,
      operationName: operation,
      ota,
    });

    return {
      ota,
      response,
    };
  });

  const settled = await Promise.allSettled(tasks);
  const successful = [];
  const failed = [];

  settled.forEach((entry, index) => {
    if (entry.status === 'fulfilled') {
      successful.push(entry.value);
    } else {
      const failedJob = {
        id: `${Date.now()}-${otas[index]}-${operation}`,
        ota: otas[index],
        operation,
        payload,
        error: entry.reason.message,
        createdAt: new Date().toISOString(),
      };
      failedSyncJobs.push(failedJob);

      notificationService.notify({
        type: 'OTA_SYNC_FAILURE',
        message: `OTA sync failure for ${otas[index]} (${operation}): ${entry.reason.message}`,
      });

      failed.push({
        ota: otas[index],
        error: entry.reason.message,
      });
    }
  });

  return {
    successful,
    failed,
  };
};

const syncAllInventory = async (roomTypeId, dateRange, otas, user) => {
  const startDate = normalizeToUtcDate(dateRange.startDate);
  const endDate = normalizeToUtcDate(dateRange.endDate);

  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const selectedOtas = resolveOtas(otas);

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: {
      property: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyAccess(roomType.property, user, 'You are not authorized to sync this room type');

  const entries = await prisma.inventory.findMany({
    where: {
      roomTypeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });

  const payload = {
    roomTypeId,
    startDate,
    endDate,
    entries,
  };

  const result = await runAdapterOperation(selectedOtas, 'syncInventory', payload);

  return {
    synced: result.failed.length === 0,
    otas: result.successful.map((item) => item.ota),
    failedOtas: result.failed,
  };
};

const syncAllRates = async (roomTypeId, dateRange, otas, user) => {
  const startDate = normalizeToUtcDate(dateRange.startDate);
  const endDate = normalizeToUtcDate(dateRange.endDate);

  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const selectedOtas = resolveOtas(otas);

  const roomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: {
      property: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!roomType) {
    throw new ApiError(404, 'Room type not found');
  }

  assertPropertyAccess(roomType.property, user, 'You are not authorized to sync this room type');

  const entries = await prisma.rate.findMany({
    where: {
      roomTypeId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { date: 'asc' },
  });

  const payload = {
    roomTypeId,
    startDate,
    endDate,
    entries,
  };

  const result = await runAdapterOperation(selectedOtas, 'syncRates', payload);

  return {
    synced: result.failed.length === 0,
    otas: result.successful.map((item) => item.ota),
    failedOtas: result.failed,
  };
};

const fetchAllBookings = async (otas, user) => {
  if (user.role !== 'ADMIN') {
    throw new ApiError(403, 'Only administrators can fetch OTA bookings');
  }

  const selectedOtas = resolveOtas(otas);
  const result = await runAdapterOperation(selectedOtas, 'fetchBookings');

  const bookings = result.successful.flatMap((item) => item.response.bookings || []);

  return {
    synced: result.failed.length === 0,
    otas: result.successful.map((item) => item.ota),
    failedOtas: result.failed,
    bookings,
  };
};

module.exports = {
  syncAllInventory,
  syncAllRates,
  fetchAllBookings,
  executeWithRetry,
  adapterRegistry,
  failedSyncJobs,
};
