const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  property: {
    findUnique: jest.fn(),
  },
  propertyManager: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  managerPropertyPermission: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');

const managerId = '11111111-1111-4111-8111-111111111111';
const propertyId = '22222222-2222-4222-8222-222222222222';

const adminToken = jwt.sign({ sub: 'admin-1', role: 'ADMIN', email: 'admin@test.com' }, process.env.JWT_SECRET, {
  expiresIn: '1d',
});

describe('Admin API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === 'admin-1') {
        return Promise.resolve({
          id: 'admin-1',
          role: 'ADMIN',
          permissions: {},
          propertyManagers: [],
        });
      }

      if (where.id === managerId) {
        return Promise.resolve({
          id: managerId,
          role: 'MANAGER',
          email: 'manager@test.com',
          propertyManagers: [],
        });
      }

      return Promise.resolve(null);
    });
  });

  it('assigns a property to a manager', async () => {
    prisma.property.findUnique.mockResolvedValue({ id: propertyId, name: 'Sea View Stays' });
    prisma.propertyManager.upsert.mockResolvedValue({ id: 'pm-1', userId: managerId, propertyId });

    const res = await request(app)
      .post('/api/admin/assign-property')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: managerId,
        propertyId,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ userId: managerId, propertyId });
  });

  it('removes a property assignment from a manager', async () => {
    prisma.propertyManager.deleteMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete('/api/admin/remove-property')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: managerId,
        propertyId,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ userId: managerId, propertyId });
  });
});
