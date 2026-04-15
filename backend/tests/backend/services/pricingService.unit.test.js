jest.mock('../../../src/services/rateService', () => ({
  updatePricing: jest.fn(),
  bulkUpdatePricing: jest.fn(),
  getPricingGrid: jest.fn(),
  getPriceForBookingDate: jest.fn(),
}));

const rateService = require('../../../src/services/rateService');
const pricingService = require('../../../src/services/pricingService');

describe('pricingService unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getPrice returns average nightly price for room + rate plan + date range', async () => {
    rateService.getPriceForBookingDate
      .mockResolvedValueOnce(1000)
      .mockResolvedValueOnce(1200)
      .mockResolvedValueOnce(1400);

    const value = await pricingService.getPrice({
      tx: {},
      roomTypeId: 'room-1',
      ratePlanId: 'plan-1',
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
    });

    expect(value).toBe(1200);
    expect(rateService.getPriceForBookingDate).toHaveBeenCalledTimes(3);
  });

  it('calculateTotals aggregates mixed GST slabs correctly', () => {
    const totals = pricingService.calculateTotals({
      rows: [
        { rooms: 1, nights: 2, pricePerNight: 999, totalCost: 1998 },
        { rooms: 1, nights: 2, pricePerNight: 1000, totalCost: 2000 },
        { rooms: 1, nights: 1, pricePerNight: 7500, totalCost: 7500 },
        { rooms: 1, nights: 1, pricePerNight: 7501, totalCost: 7501 },
      ],
      propertyState: 'GOA',
      guestState: 'GOA',
      paidAmount: 1000,
    });

    expect(totals.subtotal).toBe(18999);
    expect(totals.totalGST).toBeCloseTo(1825.18, 2);
    expect(totals.cgst).toBeCloseTo(912.59, 2);
    expect(totals.sgst).toBeCloseTo(912.59, 2);
    expect(totals.igst).toBe(0);
    expect(totals.totalAmount).toBe(20824);
    expect(totals.dueAmount).toBeCloseTo(19824, 2);
  });

  it('calculateTotals uses IGST for inter-state booking', () => {
    const totals = pricingService.calculateTotals({
      rows: [{ rooms: 1, nights: 1, pricePerNight: 2000, totalCost: 2000 }],
      propertyState: 'GOA',
      guestState: 'KARNATAKA',
      paidAmount: 0,
    });

    expect(totals.cgst).toBe(0);
    expect(totals.sgst).toBe(0);
    expect(totals.igst).toBe(100);
    expect(totals.totalAmount).toBe(2100);
  });
});
