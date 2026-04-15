const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../../src/config/prisma', () => ({
  user: {
    findUnique: jest.fn(),
  },
  $disconnect: jest.fn(),
}));

jest.mock('../../../src/services/bookingService', () => ({
  listBookings: jest.fn(),
  getBookingById: jest.fn(),
  updateBookingStatus: jest.fn(),
  createManualBooking: jest.fn(),
  updateBooking: jest.fn(),
  getInvoiceHtml: jest.fn(),
  getInvoicePdfBuffer: jest.fn(),
  syncBookingsFromOtas: jest.fn(),
}));

const prisma = require('../../../src/config/prisma');
const bookingService = require('../../../src/services/bookingService');
const app = require('../../../src/app');

const token = jwt.sign({ sub: 'manager-1', role: 'MANAGER', email: 'manager@test.com' }, process.env.JWT_SECRET, {
  expiresIn: '1d',
});

describe('Booking route critical API checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-1',
      role: 'MANAGER',
      permissions: { manage_bookings: true },
      managedProperties: [{ id: 'prop-1', name: 'Sea View', location: 'Goa' }],
      managerPropertyPermissions: [{ propertyId: 'prop-1', permissions: ['MANAGE_BOOKINGS'] }],
    });
  });

  it('GET invoice returns PDF headers and payload', async () => {
    const pdf = Buffer.from('invoice-bytes');
    bookingService.getInvoicePdfBuffer.mockResolvedValue(pdf);

    const res = await request(app)
      .get('/api/bookings/11111111-1111-4111-8111-111111111111/invoice')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('invoice-11111111-1111-4111-8111-111111111111.pdf');
  });

  it('PUT update booking returns 404 for unknown id', async () => {
    bookingService.updateBooking.mockRejectedValue({ statusCode: 404, message: 'Booking not found' });

    const res = await request(app)
      .put('/api/bookings/11111111-1111-4111-8111-111111111111')
      .set('Authorization', `Bearer ${token}`)
      .send({
        propertyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        guestName: 'Guest One',
        guestMobile: '9999999999',
        checkIn: '2026-10-01',
        checkOut: '2026-10-03',
        rooms: [{ roomTypeId: '22222222-2222-4222-8222-222222222222', rooms: 1, adults: 2 }],
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('protected booking endpoints reject unauthenticated access', async () => {
    const res = await request(app).get('/api/bookings');

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
