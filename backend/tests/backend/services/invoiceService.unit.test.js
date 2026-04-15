jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

const puppeteer = require('puppeteer');
const invoiceService = require('../../../src/services/invoiceService');

describe('invoiceService unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renderInvoiceHtml includes booking and property data', () => {
    const html = invoiceService.renderInvoiceHtml({
      booking: {
        id: 'booking-1',
        guestName: 'Alex Doe',
        guestMobile: '9999999999',
        guestEmail: 'alex@example.com',
        checkIn: '2026-08-10',
        checkOut: '2026-08-12',
        nights: 2,
        totalRooms: 1,
        subtotal: 2000,
        cgst: 50,
        sgst: 50,
        igst: 0,
        roundOff: 0,
        totalAmount: 2100,
        paidAmount: 500,
        dueAmount: 1600,
        createdAt: '2026-08-01',
      },
      property: {
        name: 'Sea View',
        fullAddress: 'Goa Beach Road',
        city: 'North Goa',
        state: 'Goa',
        gstNumber: '22ABCDE1234F1Z5',
      },
      bookingRooms: [
        {
          roomType: { name: 'Deluxe' },
          ratePlan: { mealPlanName: 'EP' },
          rooms: 1,
          pricePerNight: 1000,
          totalCost: 2000,
        },
      ],
      taxSummary: {
        totalGST: 100,
        rows: [],
      },
    });

    expect(html).toContain('Tax Invoice');
    expect(html).toContain('booking-1');
    expect(html).toContain('Alex Doe');
    expect(html).toContain('Sea View');
    expect(html).toContain('Deluxe');
  });

  it('generateInvoicePDF returns a buffer', async () => {
    const fakePdf = Buffer.from('fake-pdf-content');
    const page = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(fakePdf),
    };
    const browser = {
      newPage: jest.fn().mockResolvedValue(page),
      close: jest.fn().mockResolvedValue(undefined),
    };

    puppeteer.launch.mockResolvedValue(browser);

    const result = await invoiceService.generateInvoicePDF({
      booking: { id: 'booking-2', guestName: 'Sam', subtotal: 0, cgst: 0, sgst: 0, igst: 0, roundOff: 0, totalAmount: 0, paidAmount: 0, dueAmount: 0 },
      property: { name: 'Hill View' },
      bookingRooms: [],
      taxSummary: { totalGST: 0, rows: [] },
    });

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe(fakePdf.toString());
    expect(page.setContent).toHaveBeenCalled();
    expect(page.pdf).toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalled();
  });
});
