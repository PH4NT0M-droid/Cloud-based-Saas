const { randomBytes } = require('crypto');
const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');
const otaService = require('./ota/otaService');
const notificationService = require('./notificationService');
const {
  assertPropertyAccess,
  canManageBookings,
  hasPermission,
  getManagedPropertyIds,
} = require('./accessControl');
const { reduceInventory, restoreInventory } = require('./inventoryService');
const pricingService = require('./pricingService');
const invoiceService = require('./invoiceService');
const promotionService = require('./promotionService');

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const isUniqueConstraintViolation = (error) => error?.code === 'P2002';

const normalizeMealPlanName = (value) => String(value || '').trim().toUpperCase();

const generateManualBookingSourceId = () => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `RS-${y}${m}${d}-${suffix}`;
};

const assertBookingPermission = (user) => {
  if (!canManageBookings(user)) {
    throw new ApiError(403, 'You are not authorized to manage bookings');
  }
};

const getBookablePropertyIds = (user) => {
  if (user?.role === 'ADMIN') {
    return null;
  }

  const managedPropertyIds = getManagedPropertyIds(user);
  if (!managedPropertyIds.length) {
    return [];
  }

  return managedPropertyIds.filter((propertyId) => hasPermission(user, propertyId, 'manage_bookings'));
};

const assertManageBookingsForProperty = (user, propertyId, message = 'You are not authorized to access this booking') => {
  if (user?.role === 'ADMIN') {
    return;
  }

  if (!propertyId || !hasPermission(user, propertyId, 'manage_bookings')) {
    throw new ApiError(403, message);
  }
};

const normalizeToUtcDateTime = (input) => {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }
  return date;
};

const normalizeToUtcDate = (input) => {
  const date = normalizeToUtcDateTime(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const getBookingDateInput = (payload, existing, key, legacyKeys = []) => {
  for (const candidate of [payload?.[key], ...legacyKeys.map((alias) => payload?.[alias]), existing?.[key]]) {
    if (candidate !== undefined && candidate !== null && candidate !== '') {
      return candidate;
    }
  }

  return null;
};

const loadRoomTypeRecord = async (tx, roomTypeId) => {
  if (typeof tx?.roomType?.findUnique === 'function') {
    const roomType = await tx.roomType.findUnique({
      where: { id: roomTypeId },
      include: {
        property: true,
        ratePlans: {
          orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
        },
      },
    });

    if (roomType && (roomType.property || roomType.propertyId || Array.isArray(roomType.ratePlans))) {
      return roomType;
    }
  }

  const fallbackRoomType = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: {
      property: true,
      ratePlans: {
        orderBy: [{ isDefault: 'desc' }, { mealPlanName: 'asc' }],
      },
    },
  });

  if (!fallbackRoomType) {
    throw new ApiError(400, 'One or more room types are invalid');
  }

  return fallbackRoomType;
};

const loadPropertyRecord = async (tx, propertyId, roomType) => {
  if (roomType?.property) {
    return roomType.property;
  }

  if (typeof tx?.property?.findUnique === 'function') {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (property) {
      return property;
    }
  }

  if (propertyId) {
    return prisma.property.findUnique({ where: { id: propertyId } });
  }

  return null;
};

const getNights = (checkIn, checkOut) => {
  const start = normalizeToUtcDate(checkIn);
  const end = normalizeToUtcDate(checkOut);
  const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) {
    throw new ApiError(400, 'checkOutDate must be after checkInDate');
  }
  return nights;
};

const resolveRatePlan = (roomType, row) => {
  const ratePlans = Array.isArray(roomType?.ratePlans) ? roomType.ratePlans : [];
  if (!ratePlans.length) {
    return null;
  }

  if (row.ratePlanId) {
    const byId = ratePlans.find((ratePlan) => ratePlan.id === row.ratePlanId);
    if (!byId) {
      throw new ApiError(400, 'Selected meal plan does not belong to room type');
    }
    return byId;
  }

  const name = normalizeMealPlanName(row.ratePlanName || row.mealPlanName);
  if (name) {
    const byName = ratePlans.find((ratePlan) => normalizeMealPlanName(ratePlan.mealPlanName) === name);
    if (!byName) {
      throw new ApiError(400, 'Selected meal plan does not belong to room type');
    }
    return byName;
  }

  return ratePlans.find((ratePlan) => ratePlan.isDefault) || ratePlans[0] || null;
};

const normalizeRoomsPayload = (payload) => {
  if (Array.isArray(payload.rooms) && payload.rooms.length > 0) {
    return payload.rooms;
  }

  const roomTypeId = payload.roomTypeId || payload.room_id;
  if (!roomTypeId) {
    return [];
  }

  return [
    {
      roomTypeId,
      ratePlanId: payload.ratePlanId || payload.rate_plan_id || null,
      rooms: Number(payload.roomsCount || 1),
      adults: Number(payload.guestsCount ?? payload.guests_count ?? 1),
      extraBed: Number(payload.extraBed ?? payload.extraBeds ?? 0),
      children: Number(payload.children || 0),
      pricePerNight: payload.pricePerNight ?? payload.price_per_night,
    },
  ];
};

const normalizeBookingPayload = async ({ payload, tx, user, existing = null }) => {
  const propertyId = payload.propertyId || existing?.propertyId;
  const checkInInput = getBookingDateInput(payload, existing, 'checkInDate', ['checkIn', 'startDate', 'start_date']);
  const checkOutInput = getBookingDateInput(payload, existing, 'checkOutDate', ['checkOut', 'endDate', 'end_date']);
  if (!checkInInput || !checkOutInput) {
    throw new ApiError(400, 'checkInDate and checkOutDate are required');
  }

  const checkIn = normalizeToUtcDate(checkInInput);
  const checkOut = normalizeToUtcDate(checkOutInput);
  const nights = getNights(checkIn, checkOut);

  const roomsInput = normalizeRoomsPayload(payload);
  if (!roomsInput.length) {
    throw new ApiError(400, 'At least one room row is required');
  }

  const roomTypeIds = [...new Set(roomsInput.map((row) => row.roomTypeId).filter(Boolean))];
  const roomTypes = [];
  for (const roomTypeId of roomTypeIds) {
    roomTypes.push(await loadRoomTypeRecord(tx, roomTypeId));
  }

  const roomTypeById = roomTypes.reduce((acc, roomType) => {
    acc[roomType.id] = roomType;
    return acc;
  }, {});

  const fallbackPropertyId = propertyId || roomTypes[0].propertyId;
  const property = await loadPropertyRecord(tx, fallbackPropertyId, roomTypes[0]);
  if (!property) {
    throw new ApiError(404, 'Property not found');
  }

  assertPropertyAccess(property, user, 'You are not authorized to create bookings for this property');
  assertManageBookingsForProperty(user, property.id, 'You are not authorized to create bookings for this property');

  const bookingRooms = [];
  let totalRooms = 0;
  let aggregatedGuestCount = 0;
  const includeGstInvoice = payload.includeGstInvoice !== undefined
    ? Boolean(payload.includeGstInvoice)
    : payload.include_gst_invoice !== undefined
      ? Boolean(payload.include_gst_invoice)
      : existing
        ? Number(existing?.gstRate || existing?.cgst || existing?.sgst || existing?.igst || 0) > 0
        : true;

  for (const row of roomsInput) {
    if (!row.roomTypeId) {
      throw new ApiError(400, 'Room type is required for each row');
    }

    const roomType = roomTypeById[row.roomTypeId];
    if (!roomType) {
      throw new ApiError(400, 'Invalid room type in rows');
    }

    const roomTypePropertyId = roomType.propertyId || roomType.property?.id;
    if (roomTypePropertyId !== property.id) {
      throw new ApiError(400, 'All booking rooms must belong to the selected property');
    }

    const rooms = Number(row.rooms || 0);
    const adults = Number(row.adults || 0);
    const extraBed = Number(row.extraBed ?? row.extraBeds ?? 0);
    const children = Number(row.children || 0);
    if (rooms <= 0) {
      throw new ApiError(400, 'Rooms must be greater than 0');
    }
    if (adults < 0 || extraBed < 0 || children < 0) {
      throw new ApiError(400, 'Guests values cannot be negative');
    }

    const ratePlan = resolveRatePlan(roomType, row);
    let autoPrice = Number(roomType.basePrice || 0);
    if (ratePlan?.id) {
      try {
        autoPrice = await pricingService.getPrice({
          tx,
          roomTypeId: roomType.id,
          ratePlanId: ratePlan.id,
          checkIn,
          checkOut,
        });
      } catch (error) {
        autoPrice = Number(roomType.basePrice || 0);
      }
    }

    const basePricePerNight = row.pricePerNight !== undefined && row.pricePerNight !== null
      ? Number(row.pricePerNight)
      : Number(autoPrice);

    if (Number.isNaN(basePricePerNight) || basePricePerNight < 0) {
      throw new ApiError(400, 'Price per night must be a valid non-negative value');
    }

    const extraBedPrice = Number(ratePlan?.extraBedPrice || 0);
    const childPrice = Number(ratePlan?.childPrice || 0);
    const adultCost = round2((basePricePerNight * rooms) * nights);
    const extraBedCost = round2((extraBedPrice * extraBed) * nights);
    const childCost = round2((childPrice * children) * nights);
    const pricePerNight = round2(basePricePerNight + (extraBedPrice * extraBed) + (childPrice * children));
    const totalCost = round2(adultCost + extraBedCost + childCost);

    bookingRooms.push({
      roomTypeId: roomType.id,
      ratePlanId: ratePlan?.id || null,
      rooms,
      adults,
      extraBed,
      children,
      pricePerNight,
      totalCost,
      adultCost,
      extraBedCost,
      childCost,
      nights,
      extraBedPrice,
      childPrice,
    });

    totalRooms += rooms;
    aggregatedGuestCount += adults + extraBed + children;
  }

  const promotionDiscountPercent = await promotionService.getApplicableDiscountPercent({
    propertyId: property.id,
    date: checkIn,
    txClient: tx,
  });

  const totals = pricingService.calculateTotals({
    rows: bookingRooms,
    propertyState: property.state,
    guestState: payload.guestState || payload.guest_state,
    paidAmount: Number(payload.paidAmount ?? payload.paid_amount ?? existing?.paidAmount ?? 0),
    includeGstInvoice,
    discountPercent: promotionDiscountPercent,
  });

  if (totals.paidAmount > totals.totalAmount) {
    throw new ApiError(400, 'Paid amount cannot exceed total amount');
  }

  const primaryRow = bookingRooms[0];

  return {
    property,
    bookingRooms,
    bookingData: {
      propertyId: property.id,
      roomTypeId: primaryRow.roomTypeId,
      ratePlanId: primaryRow.ratePlanId,
      checkIn,
      checkOut,
      nights,
      totalRooms,
      guestName: payload.guestName || payload.guest_name || existing?.guestName,
      guestMobile: payload.guestMobile || payload.guest_mobile || existing?.guestMobile || null,
      guestEmail: payload.guestEmail || payload.guest_email || existing?.guestEmail || null,
      gstNumber: payload.gstNumber || payload.gst_number || existing?.gstNumber || null,
      guestAddress: payload.guestAddress || payload.guest_address || existing?.guestAddress || null,
      guestPincode: payload.guestPincode || payload.guest_pincode || existing?.guestPincode || null,
      guestState: payload.guestState || payload.guest_state || existing?.guestState || null,
      guestsCount: Math.max(1, aggregatedGuestCount || Number(payload.guestsCount || existing?.guestsCount || 1)),
      subtotal: totals.subtotal,
      includeGstInvoice,
      gstRate: totals.gstRate,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      paidAmount: totals.paidAmount,
      dueAmount: totals.dueAmount,
      paymentReference: payload.paymentReference || payload.payment_reference || existing?.paymentReference || null,
      specialNote: payload.specialNote || payload.special_note || existing?.specialNote || null,
      totalPrice: totals.totalAmount,
      status: payload.status || existing?.status || 'CONFIRMED',
    },
  };
};

const getInventoryLinesForBooking = (booking) => {
  const rows = Array.isArray(booking?.bookingRooms) ? booking.bookingRooms : [];
  if (rows.length > 0) {
    return rows.map((row) => ({
      roomTypeId: row.roomTypeId,
      rooms: Number(row.rooms || 1),
    }));
  }

  return [{
    roomTypeId: booking.roomTypeId,
    rooms: 1,
  }];
};

const replaceBookingRooms = async (tx, bookingId, bookingRooms) => {
  if (!tx.bookingRoom || typeof tx.bookingRoom.deleteMany !== 'function' || typeof tx.bookingRoom.createMany !== 'function') {
    return;
  }

  await tx.bookingRoom.deleteMany({ where: { bookingId } });

  if (!bookingRooms.length) {
    return;
  }

  await tx.bookingRoom.createMany({
    data: bookingRooms.map((row) => ({
      bookingId,
      roomTypeId: row.roomTypeId,
      ratePlanId: row.ratePlanId,
      rooms: row.rooms,
      adults: row.adults,
      extraBed: row.extraBed,
      children: row.children,
      pricePerNight: row.pricePerNight,
      totalCost: row.totalCost,
    })),
  });
};

const loadBookingRecord = async (tx, bookingId, fallback = null) => {
  if (typeof tx?.booking?.findUnique === 'function') {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: true,
        roomType: true,
        ratePlan: true,
        bookingRooms: {
          include: { roomType: true, ratePlan: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (booking) {
      return booking;
    }
  }

  return fallback;
};

const createBooking = async (payload, user) => {
  assertBookingPermission(user);

  return prisma.$transaction(async (tx) => {
    const { bookingData, bookingRooms } = await normalizeBookingPayload({ payload, tx, user });

    if (!bookingData.guestName || String(bookingData.guestName).trim().length < 2) {
      throw new ApiError(400, 'Guest name is required');
    }

    const otaSource = payload.otaSource || payload.ota_source || generateManualBookingSourceId();

    const booking = await tx.booking.create({
      data: {
        otaSource,
        ...bookingData,
        createdById: user?.id || null,
      },
    });

    await replaceBookingRooms(tx, booking.id, bookingRooms);

    if (booking.status === 'CONFIRMED') {
      for (const row of bookingRooms) {
        await reduceInventory(row.roomTypeId, booking.checkIn, booking.checkOut, tx, row.rooms);
      }
    }

    return loadBookingRecord(tx, booking.id, {
      ...booking,
      ...bookingData,
      bookingRooms,
    });
  });
};

const updateBooking = async (id, payload, user) => {
  assertBookingPermission(user);

  const existing = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: true,
      roomType: { include: { property: true } },
      bookingRooms: true,
    },
  });

  if (!existing) {
    throw new ApiError(404, 'Booking not found');
  }

  assertPropertyAccess(existing.property || existing.roomType?.property, user, 'You are not authorized to update this booking');
  assertManageBookingsForProperty(
    user,
    existing.propertyId || existing.roomType?.propertyId,
    'You are not authorized to update this booking',
  );

  return prisma.$transaction(async (tx) => {
    const oldLines = getInventoryLinesForBooking(existing);
    if (existing.status === 'CONFIRMED') {
      for (const line of oldLines) {
        await restoreInventory(line.roomTypeId, existing.checkIn, existing.checkOut, tx, line.rooms);
      }
    }

    const { bookingData, bookingRooms } = await normalizeBookingPayload({ payload, tx, user, existing });

    const updated = await tx.booking.update({
      where: { id },
      data: {
        ...bookingData,
      },
    });

    await replaceBookingRooms(tx, id, bookingRooms);

    if (updated.status === 'CONFIRMED') {
      for (const row of bookingRooms) {
        await reduceInventory(row.roomTypeId, updated.checkIn, updated.checkOut, tx, row.rooms);
      }
    }

    return loadBookingRecord(tx, id, {
      ...updated,
      ...bookingData,
      bookingRooms,
    });
  });
};

const listBookings = async (user, filters) => {
  assertBookingPermission(user);

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

  const bookablePropertyIds = getBookablePropertyIds(user);
  if (Array.isArray(bookablePropertyIds) && bookablePropertyIds.length === 0) {
    return [];
  }

  return prisma.booking.findMany({
    where:
      user?.role === 'ADMIN'
        ? where
        : {
            ...where,
            roomType: { propertyId: { in: bookablePropertyIds } },
          },
    include: {
      property: true,
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
      ratePlan: true,
      bookingRooms: {
        include: { roomType: true, ratePlan: true },
        orderBy: { createdAt: 'asc' },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getBookingById = async (id, user) => {
  assertBookingPermission(user);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: true,
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
      ratePlan: true,
      bookingRooms: {
        include: { roomType: true, ratePlan: true },
        orderBy: { createdAt: 'asc' },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  const effectiveProperty = booking.property || booking.roomType?.property;
  assertPropertyAccess(effectiveProperty, user, 'You are not authorized to access this booking');
  assertManageBookingsForProperty(user, effectiveProperty?.id, 'You are not authorized to access this booking');

  return booking;
};

const canMutateBooking = (booking, user) => {
  try {
    const effectiveProperty = booking.property || booking.roomType?.property;
    assertPropertyAccess(effectiveProperty, user);
    assertManageBookingsForProperty(user, effectiveProperty?.id, 'You are not authorized to update this booking');
    return true;
  } catch (error) {
    return false;
  }
};

const updateBookingStatus = async (id, status, user) => {
  assertBookingPermission(user);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: true,
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
      ratePlan: true,
      bookingRooms: true,
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

  const bookingLines = getInventoryLinesForBooking(booking);

  return prisma.$transaction(async (tx) => {
    if (status === 'CONFIRMED' && booking.status === 'CANCELLED') {
      for (const line of bookingLines) {
        await reduceInventory(line.roomTypeId, booking.checkIn, booking.checkOut, tx, line.rooms);
      }
    }

    if (status === 'CANCELLED' && booking.status === 'CONFIRMED') {
      for (const line of bookingLines) {
        await restoreInventory(line.roomTypeId, booking.checkIn, booking.checkOut, tx, line.rooms);
      }

      await notificationService.notify({
        type: 'BOOKING_CANCELLED',
        message: `Booking ${booking.id} cancelled and inventory restored.`,
      });
    }

    if (status === 'CONFIRMED' && booking.status === 'CANCELLED') {
      await notificationService.notify({
        type: 'BOOKING_CONFIRMED',
        message: `Booking ${booking.id} reconfirmed and inventory reduced.`,
      });
    }

    return tx.booking.update({
      where: { id },
      data: { status },
    });
  });
};

const deleteBooking = async (id, user) => {
  assertBookingPermission(user);

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      property: true,
      roomType: {
        include: {
          property: {
            select: { id: true, name: true, location: true },
          },
        },
      },
      bookingRooms: true,
    },
  });

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (!canMutateBooking(booking, user)) {
    throw new ApiError(403, 'You are not authorized to delete this booking');
  }

  const bookingLines = getInventoryLinesForBooking(booking);

  await prisma.$transaction(async (tx) => {
    if (booking.status === 'CONFIRMED') {
      for (const line of bookingLines) {
        await restoreInventory(line.roomTypeId, booking.checkIn, booking.checkOut, tx, line.rooms);
      }
    }

    await tx.booking.delete({ where: { id } });
  });

  return { id };
};

const createManualBooking = async (payload, user) => createBooking(payload, user);

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
      const created = await prisma.$transaction(async (tx) => {
        const existing = await tx.booking.findUnique({
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
          return null;
        }

        const roomType = await loadRoomTypeRecord(tx, booking.roomTypeId);

        if (!roomType) {
          throw new ApiError(404, 'Room type not found');
        }

        const defaultRatePlan = roomType.ratePlans?.find((plan) => plan.isDefault) || roomType.ratePlans?.[0] || null;
        const nightly = defaultRatePlan && tx.roomPricing
          ? await pricingService.getPrice({
              tx,
              roomTypeId: roomType.id,
              ratePlanId: defaultRatePlan.id,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
            })
          : Number(roomType.basePrice || 0);

        const nights = getNights(booking.checkIn, booking.checkOut);
        const totalCost = round2(nightly * nights);

        const bookingRecord = await tx.booking.create({
          data: {
            otaSource: booking.otaSource,
            propertyId: roomType.propertyId,
            roomTypeId: roomType.id,
            ratePlanId: defaultRatePlan?.id || null,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights,
            totalRooms: 1,
            guestName: booking.guestName,
            guestsCount: 1,
            subtotal: totalCost,
            gstRate: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            roundOff: 0,
            totalAmount: totalCost,
            paidAmount: 0,
            dueAmount: totalCost,
            totalPrice: totalCost,
            status: booking.status,
          },
        });

        if (tx.bookingRoom && typeof tx.bookingRoom.create === 'function') {
          await tx.bookingRoom.create({
            data: {
              bookingId: bookingRecord.id,
              roomTypeId: roomType.id,
              ratePlanId: defaultRatePlan?.id || null,
              rooms: 1,
              adults: 1,
              extraBed: 0,
              children: 0,
              pricePerNight: nightly,
              totalCost,
            },
          });
        }

        if (booking.status === 'CONFIRMED') {
          await reduceInventory(roomType.id, booking.checkIn, booking.checkOut, tx, 1);
        }

        return bookingRecord;
      });

      if (!created) {
        summary.duplicates += 1;
        continue;
      }

      summary.created += 1;
      summary.processedBookingIds.push(created.id);

      await notificationService.notify({
        type: 'NEW_BOOKING',
        message: `New booking received from ${booking.otaSource} for roomType ${booking.roomTypeId}`,
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        summary.duplicates += 1;
        continue;
      }
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

const getInvoicePayload = async (id, user) => {
  const booking = await getBookingById(id, user);
  const property = booking.property || booking.roomType?.property || null;

  const rows = booking.bookingRooms?.length
    ? booking.bookingRooms
    : [
        {
          roomType: booking.roomType,
          ratePlan: booking.ratePlan,
          rooms: 1,
          adults: booking.guestsCount || 1,
          extraBed: 0,
          children: 0,
          pricePerNight: booking.nights > 0 ? round2(Number(booking.subtotal || booking.totalAmount || booking.totalPrice || 0) / booking.nights) : 0,
          totalCost: booking.subtotal || booking.totalAmount || booking.totalPrice || 0,
          adultCost: booking.subtotal || booking.totalAmount || booking.totalPrice || 0,
          extraBedCost: 0,
          childCost: 0,
        },
      ];

  const promotionDiscountPercent = property?.id
    ? await promotionService.getApplicableDiscountPercent({
        propertyId: property.id,
        date: booking.checkIn,
      })
    : 0;

  const taxSummary = pricingService.calculateTotals({
    rows,
    propertyState: property?.state,
    guestState: booking.guestState,
    paidAmount: booking.paidAmount,
    includeGstInvoice: booking.includeGstInvoice !== undefined ? Boolean(booking.includeGstInvoice) : Number(booking.gstRate || 0) > 0,
    discountPercent: promotionDiscountPercent,
  });

  return {
    booking,
    property,
    bookingRooms: rows,
    taxSummary,
  };
};

const getInvoiceHtml = async (id, user) => {
  const payload = await getInvoicePayload(id, user);
  return invoiceService.renderInvoiceHtml(payload);
};

const getInvoicePdfBuffer = async (id, user) => {
  const payload = await getInvoicePayload(id, user);
  return invoiceService.generateInvoicePDF(payload);
};

module.exports = {
  listBookings,
  getBookingById,
  updateBookingStatus,
  createManualBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  syncBookingsFromOtas,
  getInvoiceHtml,
  getInvoicePdfBuffer,
};
