const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

const prisma = require('../src/config/prisma');
const app = require('../src/app');

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('logs in an existing manager', async () => {
      const passwordHash = await bcrypt.hash('Password@123', 12);

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Tarun',
        email: 'tarun@example.com',
        passwordHash,
        role: 'MANAGER',
        permissions: {
          canManageProperties: true,
          canManageRooms: true,
          canManagePricing: true,
          canManageInventory: true,
        },
        managedProperties: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'tarun@example.com',
        password: 'Password@123',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('tarun@example.com');
      expect(res.body.data.token).toBeDefined();
    });

    it('returns 401 for invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/login').send({
        email: 'tarun@example.com',
        password: 'Password@123',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });
  });
});