const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  property: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  roomType: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');

const makeToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

describe('Room API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      permissions: {},
      managedProperties: [],
    });
  });

  it('adds room type for manager property', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      role: 'MANAGER',
      permissions: {
        canManageProperties: false,
        canManageRooms: true,
        canManagePricing: false,
        canManageInventory: false,
      },
      managedProperties: [{ id: 'prop-1', name: 'Sea View Stays', location: 'Goa' }],
    });

    const managerToken = makeToken({ sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' });

    prisma.property.findUnique.mockResolvedValue({
      id: 'prop-1',
    });

    prisma.roomType.create.mockResolvedValue({
      id: 'room-1',
      propertyId: 'prop-1',
      name: 'Deluxe Room',
      maxOccupancy: 3,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        propertyId: '11111111-1111-4111-8111-111111111111',
        name: 'Deluxe Room',
        maxOccupancy: 3,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('room-1');
  });

  it('deletes room type for admin', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      permissions: {},
      managedProperties: [],
    });

    const adminToken = makeToken({ sub: 'admin-1', role: 'ADMIN', email: 'admin@test.com' });

    prisma.roomType.findUnique.mockResolvedValue({
      id: 'room-1',
      property: {
        id: 'prop-1',
      },
    });

    prisma.roomType.delete.mockResolvedValue({ id: 'room-1' });

    const res = await request(app)
      .delete('/api/rooms/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('blocks unauthenticated room listing', async () => {
    const res = await request(app).get('/api/rooms');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
