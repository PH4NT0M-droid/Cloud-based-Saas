const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  roomType: {
    findUnique: jest.fn(),
  },
  inventory: {
    findMany: jest.fn(),
  },
  rate: {
    findMany: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');
const otaService = require('../src/services/ota/otaService');

const roomTypeId = '11111111-1111-4111-8111-111111111111';
const managerToken = jwt.sign(
  { sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1d' },
);
const adminToken = jwt.sign(
  { sub: 'admin-1', role: 'ADMIN', email: 'admin@test.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1d' },
);

describe('OTA API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === 'admin-1') {
        return Promise.resolve({ id: 'admin-1', role: 'ADMIN', permissions: {}, managedProperties: [] });
      }

      return Promise.resolve({
        id: 'manager-1',
        role: 'MANAGER',
        permissions: {
          canManageProperties: false,
          canManageRooms: true,
          canManagePricing: true,
          canManageInventory: true,
        },
        managedProperties: [{ id: 'prop-1', name: 'Sea View Stays', location: 'Goa' }],
      });
    });

    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      property: {
        id: 'prop-1',
      },
    });
  });

  it('inventory sync triggers all adapters', async () => {
    prisma.inventory.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        roomTypeId,
        date: new Date('2026-09-01T00:00:00.000Z'),
        availableRooms: 8,
      },
    ]);

    const adapters = otaService.adapterRegistry;
    const bookingSpy = jest.spyOn(adapters.booking, 'syncInventory').mockResolvedValue({ ota: 'booking.com', synced: true });
    const airbnbSpy = jest.spyOn(adapters.airbnb, 'syncInventory').mockResolvedValue({ ota: 'airbnb', synced: true });
    const mmtSpy = jest.spyOn(adapters.makemytrip, 'syncInventory').mockResolvedValue({ ota: 'makemytrip', synced: true });
    const agodaSpy = jest.spyOn(adapters.agoda, 'syncInventory').mockResolvedValue({ ota: 'agoda', synced: true });

    const res = await request(app)
      .post('/api/ota/sync-inventory')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(bookingSpy).toHaveBeenCalledTimes(1);
    expect(airbnbSpy).toHaveBeenCalledTimes(1);
    expect(mmtSpy).toHaveBeenCalledTimes(1);
    expect(agodaSpy).toHaveBeenCalledTimes(1);
    expect(res.body.data.otas).toHaveLength(4);
  });

  it('rate sync works', async () => {
    prisma.rate.findMany.mockResolvedValue([
      {
        id: 'rate-1',
        roomTypeId,
        date: new Date('2026-09-01T00:00:00.000Z'),
        basePrice: 140,
        otaModifier: 1.0,
      },
    ]);

    const res = await request(app)
      .post('/api/ota/sync-rates')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        startDate: '2026-09-01',
        endDate: '2026-09-03',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.synced).toBe(true);
    expect(res.body.data.otas).toHaveLength(4);
  });

  it('booking fetch merges correctly', async () => {
    const adapters = otaService.adapterRegistry;
    jest.spyOn(adapters.booking, 'fetchBookings').mockResolvedValue({
      ota: 'booking.com',
      bookings: [{ ota: 'booking.com', guestName: 'A', roomTypeId, checkIn: '2026-09-05', checkOut: '2026-09-07' }],
    });
    jest.spyOn(adapters.airbnb, 'fetchBookings').mockResolvedValue({
      ota: 'airbnb',
      bookings: [{ ota: 'airbnb', guestName: 'B', roomTypeId, checkIn: '2026-09-06', checkOut: '2026-09-08' }],
    });
    jest.spyOn(adapters.makemytrip, 'fetchBookings').mockResolvedValue({
      ota: 'makemytrip',
      bookings: [{ ota: 'makemytrip', guestName: 'C', roomTypeId, checkIn: '2026-09-09', checkOut: '2026-09-10' }],
    });
    jest.spyOn(adapters.agoda, 'fetchBookings').mockResolvedValue({
      ota: 'agoda',
      bookings: [{ ota: 'agoda', guestName: 'D', roomTypeId, checkIn: '2026-09-11', checkOut: '2026-09-12' }],
    });

    const res = await request(app).get('/api/ota/bookings').set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bookings).toHaveLength(4);
  });

  it('retry mechanism works', async () => {
    const flaky = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValue('ok');

    const result = await otaService.executeWithRetry(flaky, {
      retries: 2,
      retryDelayMs: 0,
      operationName: 'syncInventory',
      ota: 'booking',
    });

    expect(result).toBe('ok');
    expect(flaky).toHaveBeenCalledTimes(3);
  });
});
