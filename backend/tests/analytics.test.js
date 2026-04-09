jest.mock('../src/config/prisma', () => ({
  booking: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  inventory: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  roomType: {
    findUnique: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const analyticsService = require('../src/services/analyticsService');
const pricingEngine = require('../src/services/pricingEngine');

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates revenue analytics correctly', async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        checkIn: new Date('2026-11-01T00:00:00.000Z'),
        checkOut: new Date('2026-11-03T00:00:00.000Z'),
        totalPrice: 200,
      },
    ]);

    const result = await analyticsService.getRevenueAnalytics({
      startDate: '2026-11-01',
      endDate: '2026-11-05',
    });

    expect(result.totalRevenue).toBe(200);
    expect(result.revenuePerDay).toHaveLength(2);
  });

  it('calculates occupancy metrics correctly', async () => {
    prisma.inventory.findMany.mockResolvedValue([
      {
        roomTypeId: 'room-1',
        date: new Date('2026-11-01T00:00:00.000Z'),
        availableRooms: 8,
      },
      {
        roomTypeId: 'room-1',
        date: new Date('2026-11-02T00:00:00.000Z'),
        availableRooms: 7,
      },
    ]);

    prisma.booking.findMany.mockResolvedValue([
      {
        roomTypeId: 'room-1',
        checkIn: new Date('2026-11-01T00:00:00.000Z'),
        checkOut: new Date('2026-11-03T00:00:00.000Z'),
      },
    ]);

    const result = await analyticsService.getOccupancyAnalytics({
      roomTypeId: 'room-1',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
    });

    expect(result.bookedRooms).toBe(2);
    expect(result.totalAvailableRooms).toBe(17);
    expect(result.occupancyRate).toBeCloseTo(11.76, 1);
  });

  it('returns OTA performance totals correctly', async () => {
    prisma.booking.groupBy.mockResolvedValue([
      { otaSource: 'booking.com', _count: { _all: 3 }, _sum: { totalPrice: 540 } },
      { otaSource: 'airbnb', _count: { _all: 2 }, _sum: { totalPrice: 300 } },
    ]);

    const result = await analyticsService.getOtaPerformance();
    expect(result.performance).toHaveLength(2);
    expect(result.performance[0].bookings).toBe(3);
    expect(result.performance[0].revenue).toBe(540);
  });
});

describe('Pricing Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies high occupancy smart pricing rule', async () => {
    prisma.roomType.findUnique.mockResolvedValue({ id: 'room-1', maxOccupancy: 10 });
    prisma.inventory.findUnique.mockResolvedValue({ availableRooms: 1 });
    prisma.booking.count.mockResolvedValue(2);

    const result = await pricingEngine.getSmartPrice('room-1', '2026-11-10', 100);
    expect(result.smartBasePrice).toBe(120);
  });

  it('applies low occupancy smart pricing rule', async () => {
    prisma.roomType.findUnique.mockResolvedValue({ id: 'room-1', maxOccupancy: 10 });
    prisma.inventory.findUnique.mockResolvedValue({ availableRooms: 9 });
    prisma.booking.count.mockResolvedValue(1);

    const result = await pricingEngine.getSmartPrice('room-1', '2026-11-10', 100);
    expect(result.smartBasePrice).toBe(90);
  });
});
