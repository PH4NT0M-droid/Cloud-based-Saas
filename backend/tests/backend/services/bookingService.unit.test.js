jest.mock('../../../src/config/prisma', () => ({
  booking: {
    findUnique: jest.fn(),
  },
  roomType: {
    findUnique: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../../../src/services/ota/otaService', () => ({
  fetchAllBookings: jest.fn(),
}));

jest.mock('../../../src/services/notificationService', () => ({
  notifyBookingCreated: jest.fn(),
}));

jest.mock('../../../src/services/accessControl', () => ({
  assertPropertyAccess: jest.fn(),
  canManageBookings: jest.fn().mockReturnValue(true),
  hasPermission: jest.fn().mockReturnValue(true),
  getManagedPropertyIds: jest.fn().mockReturnValue(['prop-1']),
}));

jest.mock('../../../src/services/inventoryService', () => ({
  reduceInventory: jest.fn(),
  restoreInventory: jest.fn(),
}));

jest.mock('../../../src/services/pricingService', () => ({
  getPrice: jest.fn(),
  calculateTotals: jest.fn(),
}));

jest.mock('../../../src/services/invoiceService', () => ({
  renderInvoiceHtml: jest.fn(),
  generateInvoicePDF: jest.fn(),
}));

const prisma = require('../../../src/config/prisma');
const bookingService = require('../../../src/services/bookingService');
const pricingService = require('../../../src/services/pricingService');
const inventoryService = require('../../../src/services/inventoryService');

describe('bookingService unit', () => {
  const user = { id: 'manager-1', role: 'MANAGER' };

  beforeEach(() => {
    jest.clearAllMocks();

    pricingService.getPrice.mockImplementation(async ({ roomTypeId }) => (roomTypeId === 'room-1' ? 1500 : 2500));
    pricingService.calculateTotals.mockImplementation(({ rows, paidAmount = 0 }) => {
      const subtotal = rows.reduce((sum, row) => sum + Number(row.totalCost || 0), 0);
      const totalGST = Number((subtotal * 0.05).toFixed(2));
      const totalAmount = Math.round(subtotal + totalGST);
      return {
        subtotal,
        totalGST,
        gstRate: 5,
        cgst: Number((totalGST / 2).toFixed(2)),
        sgst: Number((totalGST / 2).toFixed(2)),
        igst: 0,
        roundOff: Number((totalAmount - (subtotal + totalGST)).toFixed(2)),
        totalAmount,
        paidAmount,
        dueAmount: Number((totalAmount - paidAmount).toFixed(2)),
      };
    });
  });

  it('createBooking succeeds and aggregates multiple room rows', async () => {
    const tx = {
      roomType: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'room-1',
            propertyId: 'prop-1',
            property: { id: 'prop-1', state: 'GOA' },
            ratePlans: [{ id: 'plan-1', mealPlanName: 'EP', isDefault: true }],
          })
          .mockResolvedValueOnce({
            id: 'room-2',
            propertyId: 'prop-1',
            property: { id: 'prop-1', state: 'GOA' },
            ratePlans: [{ id: 'plan-2', mealPlanName: 'CP', isDefault: true }],
          }),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prop-1', state: 'GOA' }),
      },
      booking: {
        create: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'CONFIRMED',
          checkIn: new Date('2026-09-01T00:00:00.000Z'),
          checkOut: new Date('2026-09-03T00:00:00.000Z'),
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', bookingRooms: [] }),
      },
      bookingRoom: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const payload = {
      propertyId: 'prop-1',
      guestName: 'Guest A',
      guestMobile: '9999999999',
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      paidAmount: 1000,
      rooms: [
        { roomTypeId: 'room-1', ratePlanId: 'plan-1', rooms: 2, adults: 2 },
        { roomTypeId: 'room-2', ratePlanId: 'plan-2', rooms: 1, adults: 1 },
      ],
    };

    await bookingService.createBooking(payload, user);

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalRooms: 3,
          nights: 2,
          subtotal: 11000,
          totalAmount: 11550,
          dueAmount: 10550,
        }),
      }),
    );
    expect(inventoryService.reduceInventory).toHaveBeenCalledTimes(2);
    expect(inventoryService.reduceInventory).toHaveBeenNthCalledWith(
      1,
      'room-1',
      expect.any(Date),
      expect.any(Date),
      tx,
      2,
    );
  });

  it('createBooking fails on missing required fields', async () => {
    await expect(
      bookingService.createBooking(
        {
          propertyId: 'prop-1',
          guestName: 'Guest A',
          guestMobile: '9999999999',
          checkIn: '2026-09-01',
          rooms: [{ roomTypeId: 'room-1', rooms: 1, adults: 1 }],
        },
        user,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('updateBooking recalculates totals and restores/reduces inventory safely', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      propertyId: 'prop-1',
      checkIn: new Date('2026-09-01T00:00:00.000Z'),
      checkOut: new Date('2026-09-03T00:00:00.000Z'),
      status: 'CONFIRMED',
      property: { id: 'prop-1', state: 'GOA' },
      roomType: { property: { id: 'prop-1', state: 'GOA' } },
      bookingRooms: [{ roomTypeId: 'room-1', rooms: 1 }],
    });

    const tx = {
      roomType: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          propertyId: 'prop-1',
          property: { id: 'prop-1', state: 'GOA' },
          ratePlans: [{ id: 'plan-1', mealPlanName: 'EP', isDefault: true }],
        }),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prop-1', state: 'GOA' }),
      },
      booking: {
        update: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: 'CONFIRMED',
          checkIn: new Date('2026-09-02T00:00:00.000Z'),
          checkOut: new Date('2026-09-04T00:00:00.000Z'),
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', bookingRooms: [] }),
      },
      bookingRoom: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    await bookingService.updateBooking(
      'booking-1',
      {
        checkIn: '2026-09-02',
        checkOut: '2026-09-04',
        rooms: [{ roomTypeId: 'room-1', ratePlanId: 'plan-1', rooms: 2, adults: 2 }],
      },
      user,
    );

    expect(inventoryService.restoreInventory).toHaveBeenCalledWith(
      'room-1',
      expect.any(Date),
      expect.any(Date),
      tx,
      1,
    );
    expect(inventoryService.reduceInventory).toHaveBeenCalledWith(
      'room-1',
      expect.any(Date),
      expect.any(Date),
      tx,
      2,
    );
    expect(tx.booking.update).toHaveBeenCalled();
  });

  it('createBooking persists guest pincode, respects GST toggle false, and includes extra bed pricing in subtotal', async () => {
    const tx = {
      roomType: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'room-1',
          propertyId: 'prop-1',
          property: { id: 'prop-1', state: 'GOA' },
          ratePlans: [{ id: 'plan-1', mealPlanName: 'EP', isDefault: true, extraBedPrice: 300 }],
        }),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({ id: 'prop-1', state: 'GOA' }),
      },
      booking: {
        create: jest.fn().mockResolvedValue({
          id: 'booking-2',
          status: 'CONFIRMED',
          checkIn: new Date('2026-09-01T00:00:00.000Z'),
          checkOut: new Date('2026-09-03T00:00:00.000Z'),
        }),
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-2', bookingRooms: [] }),
      },
      bookingRoom: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    pricingService.calculateTotals.mockImplementationOnce(({ rows, paidAmount, includeGstInvoice }) => {
      expect(includeGstInvoice).toBe(false);
      expect(rows).toHaveLength(1);
      // (1500 * 1 + 300 * 2) * 2 nights = 4200
      expect(rows[0].totalCost).toBe(4200);

      return {
        subtotal: 4200,
        totalGST: 0,
        gstRate: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        roundOff: 0,
        totalAmount: 4200,
        paidAmount,
        dueAmount: 4200 - paidAmount,
      };
    });

    await bookingService.createBooking(
      {
        propertyId: 'prop-1',
        guestName: 'Guest B',
        guestMobile: '9999999999',
        guestPincode: '403001',
        includeGstInvoice: false,
        checkIn: '2026-09-01',
        checkOut: '2026-09-03',
        paidAmount: 200,
        rooms: [
          {
            roomTypeId: 'room-1',
            ratePlanId: 'plan-1',
            rooms: 1,
            adults: 2,
            extraBed: 2,
          },
        ],
      },
      user,
    );

    expect(tx.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          guestPincode: '403001',
          includeGstInvoice: false,
          subtotal: 4200,
          totalAmount: 4200,
          dueAmount: 4000,
        }),
      }),
    );
  });
});
