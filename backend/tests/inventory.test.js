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
  inventory: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');

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

describe('Inventory API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
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
  });

  it('single update works', async () => {
    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      property: {
        id: 'prop-1',
      },
    });

    prisma.inventory.upsert.mockResolvedValue({
      id: 'inv-1',
      roomTypeId,
      date: new Date('2026-05-01T00:00:00.000Z'),
      availableRooms: 7,
    });

    const res = await request(app)
      .post('/api/inventory/update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        date: '2026-05-01',
        availableRooms: 7,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.availableRooms).toBe(7);
  });

  it('bulk update works', async () => {
    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      property: {
        id: 'prop-1',
      },
    });

    const tx = {
      inventory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'inv-1',
            roomTypeId,
            date: new Date('2026-05-01T00:00:00.000Z'),
            availableRooms: 5,
          },
          {
            id: 'inv-2',
            roomTypeId,
            date: new Date('2026-05-02T00:00:00.000Z'),
            availableRooms: 5,
          },
          {
            id: 'inv-3',
            roomTypeId,
            date: new Date('2026-05-03T00:00:00.000Z'),
            availableRooms: 5,
          },
        ]),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const res = await request(app)
      .post('/api/inventory/bulk-update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        availableRooms: 5,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updatedCount).toBe(3);
  });

  it('calendar fetch returns sorted data', async () => {
    prisma.inventory.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        roomTypeId,
        date: new Date('2026-05-01T00:00:00.000Z'),
        availableRooms: 4,
      },
      {
        id: 'inv-2',
        roomTypeId,
        date: new Date('2026-05-02T00:00:00.000Z'),
        availableRooms: 6,
      },
    ]);

    prisma.roomType.findUnique.mockResolvedValue({
      id: roomTypeId,
      property: {
        id: 'prop-1',
      },
    });

    const res = await request(app)
      .get('/api/inventory/calendar')
      .set('Authorization', `Bearer ${managerToken}`)
      .query({
        roomTypeId,
        startDate: '2026-05-01',
        endDate: '2026-05-10',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.entries[0].availableRooms).toBe(4);
    expect(res.body.data.entries[1].availableRooms).toBe(6);
  });

  it('invalid dates are rejected', async () => {
    const res = await request(app)
      .post('/api/inventory/bulk-update')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        roomTypeId,
        startDate: '2026-06-05',
        endDate: '2026-06-03',
        availableRooms: 5,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('unauthorized access is blocked', async () => {
    const res = await request(app).post('/api/inventory/update').send({
      roomTypeId,
      date: '2026-05-01',
      availableRooms: 7,
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
