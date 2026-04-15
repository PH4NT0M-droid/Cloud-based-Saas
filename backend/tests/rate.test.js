const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  roomType: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  roomPricing: {
    upsert: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');

const roomTypeId = '11111111-1111-4111-8111-111111111111';
const ratePlanId = '22222222-2222-4222-8222-222222222222';
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

describe('Pricing API', () => {
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
      propertyManagers: [{ property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' } }],
      managerPropertyPermissions: [{ propertyId: 'prop-1', permissions: ['MANAGE_PRICING'] }],
    });

    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      property: { id: 'prop-1' },
      propertyId: 'prop-1',
      ratePlans: [
        { id: ratePlanId, mealPlanName: 'EP', isDefault: true },
      ],
    });
  });

  it('single pricing update works', async () => {
    prisma.roomPricing.upsert.mockResolvedValue({
      id: 'rp-1',
      roomTypeId,
      ratePlanId,
      date: new Date('2026-07-01T00:00:00.000Z'),
      price: 150,
      ratePlan: { id: ratePlanId, mealPlanName: 'EP' },
    });

    const res = await request(app)
      .post('/api/pricing/update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        ratePlanId,
        date: '2026-07-01',
        price: 150,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.price).toBe(150);
    expect(res.body.data.mealPlanName).toBe('EP');
  });

  it('bulk pricing update works', async () => {
    const tx = {
      roomPricing: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const res = await request(app)
      .post('/api/pricing/bulk-update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        ratePlanId,
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        price: 200,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updatedCount).toBe(3);
  });

  it('pricing grid works for staff read-only access', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1',
      role: 'STAFF',
      permissions: {},
      managedProperties: [{ id: 'prop-1', name: 'Sea View Stays', location: 'Goa' }],
      propertyManagers: [{ property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' } }],
      managerPropertyPermissions: [{ propertyId: 'prop-1', permissions: ['MANAGE_PRICING'] }],
    });

    prisma.roomType.findMany.mockResolvedValue([
      {
        id: roomTypeId,
        name: 'Deluxe',
        property: { id: 'prop-1' },
        ratePlans: [{ id: ratePlanId, mealPlanName: 'EP', isDefault: true }],
        roomPricings: [],
      },
    ]);

    const tx = {
      roomPricing: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      roomType: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: roomTypeId,
            name: 'Deluxe',
            ratePlans: [{ id: ratePlanId, mealPlanName: 'EP', isDefault: true }],
            roomPricings: [{ ratePlanId, date: new Date('2026-07-01T00:00:00.000Z'), price: 110 }],
          },
        ]),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const res = await request(app)
      .get('/api/pricing/grid')
      .set('Authorization', `Bearer ${staffToken}`)
      .query({
        roomTypeId,
        startDate: '2026-07-01',
        endDate: '2026-07-01',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.rows)).toBe(true);
  });

  it('invalid inputs are rejected', async () => {
    const res = await request(app)
      .post('/api/pricing/update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        date: 'not-a-date',
        price: -10,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
