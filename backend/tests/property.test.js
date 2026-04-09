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
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');

const makeToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

describe('Property API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      permissions: {},
      propertyManagers: [],
    });
  });

  it('creates property for admin', async () => {
    const adminToken = makeToken({ sub: 'admin-1', role: 'ADMIN', email: 'admin@test.com' });
    prisma.property.create.mockResolvedValue({
      id: 'prop-1',
      name: 'Sea View Stays',
      location: 'Goa',
      description: 'Beachside property',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Sea View Stays',
        location: 'Goa',
        description: 'Beachside property',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('prop-1');
  });

  it('fetches properties for manager', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      permissions: {
        canManageProperties: true,
        canManageRooms: true,
        canManagePricing: true,
        canManageInventory: true,
      },
      propertyManagers: [
        {
          propertyId: 'prop-1',
          property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' },
        },
      ],
    });

    const managerToken = makeToken({ sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' });

    prisma.property.findMany.mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Sea View Stays',
        location: 'Goa',
        description: 'Beachside property',
        propertyManagers: [
          {
            user: {
              id: 'manager-1',
              name: 'Manager One',
              email: 'manager@test.com',
              role: 'MANAGER',
            },
          },
        ],
        roomTypes: [],
      },
    ]);

    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].managers).toHaveLength(1);
  });

  it('allows manager to access multiple assigned properties', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      role: 'MANAGER',
      permissions: {
        canManageProperties: true,
        canManageRooms: true,
        canManagePricing: true,
        canManageInventory: true,
      },
      propertyManagers: [
        {
          propertyId: 'prop-1',
          property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' },
        },
        {
          propertyId: 'prop-2',
          property: { id: 'prop-2', name: 'Hill Crest', location: 'Manali' },
        },
      ],
    });

    const managerToken = makeToken({ sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' });

    prisma.property.findMany.mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Sea View Stays',
        location: 'Goa',
        description: 'Beachside property',
        propertyManagers: [{ user: { id: 'manager-1', name: 'Manager One', email: 'manager@test.com', role: 'MANAGER' } }],
        roomTypes: [],
      },
      {
        id: 'prop-2',
        name: 'Hill Crest',
        location: 'Manali',
        description: 'Mountain stay',
        propertyManagers: [{ user: { id: 'manager-1', name: 'Manager One', email: 'manager@test.com', role: 'MANAGER' } }],
        roomTypes: [],
      },
    ]);

    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('shows multiple managers for a shared property', async () => {
    const adminToken = makeToken({ sub: 'admin-1', role: 'ADMIN', email: 'admin@test.com' });
    prisma.property.findMany.mockResolvedValue([
      {
        id: 'prop-1',
        name: 'Sea View Stays',
        location: 'Goa',
        description: 'Beachside property',
        propertyManagers: [
          { user: { id: 'manager-1', name: 'Manager One', email: 'manager1@test.com', role: 'MANAGER' } },
          { user: { id: 'manager-2', name: 'Manager Two', email: 'manager2@test.com', role: 'MANAGER' } },
        ],
        roomTypes: [],
      },
    ]);

    const res = await request(app)
      .get('/api/properties')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].managers).toHaveLength(2);
  });

  it('blocks manager from accessing unassigned property by id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      role: 'MANAGER',
      permissions: {
        canManageProperties: true,
        canManageRooms: true,
        canManagePricing: true,
        canManageInventory: true,
      },
      propertyManagers: [
        {
          propertyId: 'prop-1',
          property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' },
        },
      ],
    });

    const managerToken = makeToken({ sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' });
    prisma.property.findUnique.mockResolvedValue({
      id: 'prop-2',
      name: 'Hill Crest',
      location: 'Manali',
      description: 'Mountain stay',
      propertyManagers: [],
      roomTypes: [],
    });

    const res = await request(app)
      .get('/api/properties/22222222-2222-4222-8222-222222222222')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('blocks manager from creating property', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      name: 'Manager One',
      email: 'manager@test.com',
      role: 'MANAGER',
      permissions: {
        canManageProperties: true,
        canManageRooms: true,
        canManagePricing: true,
        canManageInventory: true,
      },
      propertyManagers: [
        {
          propertyId: 'prop-1',
          property: { id: 'prop-1', name: 'Sea View Stays', location: 'Goa' },
        },
      ],
    });

    const managerToken = makeToken({ sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' });

    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Hill View',
        location: 'Manali',
        description: 'Mountain side stay',
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
