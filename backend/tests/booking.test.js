const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  roomType: {
    findUnique: jest.fn(),
  },
  rate: {
    findMany: jest.fn(),
  },
  inventory: {
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
}));

jest.mock('../src/services/ota/otaService', () => ({
  fetchAllBookings: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const otaService = require('../src/services/ota/otaService');
const app = require('../src/app');

const adminToken = jwt.sign({ sub: 'admin-1', role: 'ADMIN', email: 'admin@test.com' }, process.env.JWT_SECRET, {
  expiresIn: '1d',
});
const managerToken = jwt.sign(
  { sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1d' },
);
const staffToken = jwt.sign({ sub: 'staff-1', role: 'STAFF', email: 'staff@test.com' }, process.env.JWT_SECRET, {
  expiresIn: '1d',
});

describe('Booking API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === 'admin-1') {
        return Promise.resolve({ id: 'admin-1', role: 'ADMIN', permissions: {}, managedProperties: [] });
      }

      if (where.id === 'manager-1') {
        return Promise.resolve({
          id: 'manager-1',
          role: 'MANAGER',
          permissions: {
            canManageProperties: false,
            canManageRooms: false,
            canManagePricing: false,
            canManageInventory: true,
          },
          managedProperties: [{ id: 'prop-1', name: 'Sea View Stays', location: 'Goa' }],
        });
      }

      return Promise.resolve({ id: 'staff-1', role: 'STAFF', permissions: {}, managedProperties: [] });
    });
  });

  it('sync bookings creates records for admin', async () => {
    otaService.fetchAllBookings.mockResolvedValue({
      failedOtas: [],
      bookings: [
        {
          ota: 'booking.com',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          guestName: 'John Doe',
          status: 'CONFIRMED',
        },
      ],
    });

    prisma.booking.findUnique.mockResolvedValue(null);

    const tx = {
      roomType: {
        findUnique: jest.fn().mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', maxOccupancy: 10 }),
      },
      rate: {
        findMany: jest.fn().mockResolvedValue([
          { date: new Date('2026-10-01T00:00:00.000Z'), basePrice: 100, otaModifier: 1 },
          { date: new Date('2026-10-02T00:00:00.000Z'), basePrice: 100, otaModifier: 1 },
        ]),
      },
      inventory: {
        findMany: jest.fn().mockResolvedValue([
          { date: new Date('2026-10-01T00:00:00.000Z'), availableRooms: 1 },
          { date: new Date('2026-10-02T00:00:00.000Z'), availableRooms: 1 },
        ]),
        count: jest.fn().mockResolvedValue(2),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      booking: {
        create: jest.fn().mockResolvedValue({ id: 'b-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const res = await request(app).post('/api/bookings/sync').set('Authorization', `Bearer ${adminToken}`).send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.created).toBe(1);
  });

  it('prevents duplicate booking creation during sync', async () => {
    otaService.fetchAllBookings.mockResolvedValue({
      failedOtas: [],
      bookings: [
        {
          ota: 'booking.com',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          guestName: 'John Doe',
          status: 'CONFIRMED',
        },
      ],
    });

    prisma.booking.findUnique.mockResolvedValue({ id: 'existing-booking' });

    const res = await request(app).post('/api/bookings/sync').set('Authorization', `Bearer ${adminToken}`).send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.data.duplicates).toBe(1);
    expect(res.body.data.created).toBe(0);
  });

  it('cancelled booking restores inventory for assigned manager', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b-1',
      roomTypeId: '11111111-1111-4111-8111-111111111111',
      checkIn: new Date('2026-10-01T00:00:00.000Z'),
      checkOut: new Date('2026-10-03T00:00:00.000Z'),
      status: 'CONFIRMED',
      roomType: {
        property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' },
      },
    });

    const tx = {
      inventory: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([
          { date: new Date('2026-10-01T00:00:00.000Z') },
          { date: new Date('2026-10-02T00:00:00.000Z') },
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      booking: {
        update: jest.fn().mockResolvedValue({ id: 'b-1', status: 'CANCELLED' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const res = await request(app)
      .put('/api/bookings/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/status')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('unauthorized status update is blocked for staff', async () => {
    const res = await request(app)
      .put('/api/bookings/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/status')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('staff can view bookings', async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'b-1',
        otaSource: 'booking.com',
      },
    ]);

    const res = await request(app).get('/api/bookings').set('Authorization', `Bearer ${staffToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });
});