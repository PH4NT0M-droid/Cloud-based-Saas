const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
  },
  roomType: {
    findUnique: jest.fn(),
  },
  booking: {
    count: jest.fn(),
  },
  inventory: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  rate: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');
const rateService = require('../src/services/rateService');

const roomTypeId = '11111111-1111-4111-8111-111111111111';
const managerToken = jwt.sign(
  { sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1d' },
);
const staffToken = jwt.sign(
  { sub: 'staff-1', role: 'STAFF', email: 'staff@test.com' },
  process.env.JWT_SECRET,
  { expiresIn: '1d' },
);

describe('Rate API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      role: 'MANAGER',
      permissions: {
        canManageProperties: false,
        canManageRooms: false,
        canManagePricing: true,
        canManageInventory: false,
      },
      managedProperties: [{ id: 'prop-1', name: 'Sea View Stays', location: 'Goa' }],
    });
  });

  it('single update works', async () => {
    prisma.booking.count.mockResolvedValue(1);
    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      maxOccupancy: 10,
      property: {
        id: 'prop-1',
      },
    });

    prisma.inventory.findUnique.mockResolvedValue({
      availableRooms: 1,
    });

    prisma.rate.upsert.mockResolvedValue({
      id: 'rate-1',
      roomTypeId,
      date: new Date('2026-07-01T00:00:00.000Z'),
      basePrice: 100,
      otaModifier: 1.1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/rates/update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        date: '2026-07-01',
        basePrice: 100,
        otaModifier: 1.1,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.basePrice).toBe(100);
    expect(res.body.data.effectivePrice).toBe(132);
  });

  it('bulk update works', async () => {
    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      maxOccupancy: 10,
      property: {
        id: 'prop-1',
      },
    });

    prisma.inventory.findMany.mockResolvedValue([
      { date: new Date('2026-07-01T00:00:00.000Z'), availableRooms: 9 },
      { date: new Date('2026-07-02T00:00:00.000Z'), availableRooms: 8 },
      { date: new Date('2026-07-03T00:00:00.000Z'), availableRooms: 1 },
    ]);

    const tx = {
      rate: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rate-1',
            roomTypeId,
            date: new Date('2026-07-01T00:00:00.000Z'),
            basePrice: 200,
            otaModifier: 1.0,
          },
          {
            id: 'rate-2',
            roomTypeId,
            date: new Date('2026-07-02T00:00:00.000Z'),
            basePrice: 200,
            otaModifier: 1.0,
          },
          {
            id: 'rate-3',
            roomTypeId,
            date: new Date('2026-07-03T00:00:00.000Z'),
            basePrice: 200,
            otaModifier: 1.0,
          },
        ]),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const res = await request(app)
      .post('/api/rates/bulk-update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        basePrice: 200,
        otaModifier: 1.0,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updatedCount).toBe(3);
  });

  it('fetch rates works for staff read-only access', async () => {
    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      maxOccupancy: 10,
      property: {
        id: 'prop-1',
      },
    });

    prisma.rate.findMany.mockResolvedValue([
      {
        id: 'rate-1',
        roomTypeId,
        date: new Date('2026-07-01T00:00:00.000Z'),
        basePrice: 150,
        otaModifier: 1.1,
      },
    ]);

    prisma.inventory.findMany.mockResolvedValue([{ date: new Date('2026-07-01T00:00:00.000Z'), availableRooms: 1 }]);

    const res = await request(app)
      .get('/api/rates')
      .set('Authorization', `Bearer ${staffToken}`)
      .query({
        roomTypeId,
        startDate: '2026-07-01',
        endDate: '2026-07-10',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.entries[0].effectivePrice).toBe(198);
  });

  it('dynamic pricing helper applies high and low occupancy rules correctly', async () => {
    prisma.roomType.findUnique.mockResolvedValue({ id: roomTypeId, maxOccupancy: 10 });
    prisma.inventory.findUnique.mockResolvedValue({ availableRooms: 1 });
    prisma.booking.count.mockResolvedValue(1);

    const surgePrice = await rateService.applyDynamicPricing(roomTypeId, '2026-07-05', 100);
    expect(surgePrice).toBe(120);

    prisma.inventory.findUnique.mockResolvedValue({ availableRooms: 9 });
    prisma.booking.count.mockResolvedValue(1);
    const discountPrice = await rateService.applyDynamicPricing(roomTypeId, '2026-07-06', 100);
    expect(discountPrice).toBe(90);
  });

  it('invalid inputs are rejected', async () => {
    const res = await request(app)
      .post('/api/rates/update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        date: 'not-a-date',
        basePrice: -10,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
