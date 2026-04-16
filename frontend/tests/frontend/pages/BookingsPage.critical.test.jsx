import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingsPage from '../../../src/pages/BookingsPage';

const pushToast = vi.fn();

vi.mock('../../../src/services/bookingService', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'booking-1',
        guestName: 'Jane',
        checkIn: '2026-09-01',
        checkOut: '2026-09-03',
        totalAmount: 2100,
        paidAmount: 500,
        dueAmount: 1600,
        status: 'CONFIRMED',
        property: { name: 'Sea View' },
      },
    ]),
    getById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 'booking-2' }),
    update: vi.fn().mockResolvedValue({ id: 'booking-1' }),
    cancel: vi.fn().mockResolvedValue({ id: 'booking-1', status: 'CANCELLED' }),
    remove: vi.fn().mockResolvedValue({ id: 'booking-1' }),
    previewInvoice: vi.fn().mockResolvedValue({ html: '<h1>Invoice</h1>' }),
    downloadInvoice: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
  },
}));

vi.mock('../../../src/services/promotionService', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../src/services/propertyService', () => ({
  default: {
    getAll: vi.fn().mockResolvedValue([{ id: 'prop-1', name: 'Sea View', state: 'GOA' }]),
  },
}));

vi.mock('../../../src/services/roomService', () => ({
  default: {
    getByProperty: vi.fn().mockResolvedValue([
      {
        id: 'room-1',
        propertyId: 'prop-1',
        name: 'Deluxe',
        ratePlans: [
          { id: 'plan-1', mealPlanName: 'EP', isDefault: true },
          { id: 'plan-2', mealPlanName: 'CP', isDefault: false },
        ],
      },
    ]),
  },
}));

vi.mock('../../../src/services/rateService', () => ({
  default: {
    getPricingGrid: vi.fn().mockResolvedValue({
      dates: ['2026-09-01', '2026-09-02'],
      rows: [
        {
          roomTypeId: 'room-1',
          ratePlans: [
            {
              ratePlanId: 'plan-1',
              prices: {
                '2026-09-01': 1000,
                '2026-09-02': 1000,
              },
            },
          ],
        },
      ],
    }),
  },
}));

vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ pushToast }),
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  default: () => ({
    user: {
      role: 'ADMIN',
      permissions: { manage_bookings: true },
    },
  }),
}));

vi.mock('../../../src/components/Modal', () => ({
  default: ({ open, children, title }) => (open ? <section><h3>{title}</h3>{children}</section> : null),
}));

describe('BookingsPage critical flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:invoice');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows validation error for missing required fields', async () => {
    render(
      <MemoryRouter>
        <BookingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Manual Booking Ledger')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /create booking/i }));
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'prop-1' } });
    fireEvent.change(screen.getByLabelText('Guest Name'), { target: { value: 'Test Guest' } });
    fireEvent.change(screen.getByLabelText('Mobile'), { target: { value: '9999999999' } });
    fireEvent.change(screen.getByLabelText('Check-in Date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Check-out Date'), { target: { value: '2026-09-01' } });

    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
    });

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'room-1' } });
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'plan-1' } });

    fireEvent.click(screen.getAllByRole('button', { name: /^create booking$/i })[1]);

    await waitFor(() => {
      expect(pushToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', title: 'Validation failed' }),
      );
    });
  });

  it('supports add/remove room rows and auto-to-manual pricing with GST changes', async () => {
    render(
      <MemoryRouter>
        <BookingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Manual Booking Ledger').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /create booking/i }));

    fireEvent.click(screen.getByRole('button', { name: /add row/i }));
    expect(screen.getAllByRole('button', { name: /remove/i }).length).toBe(2);

    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[1]);
    expect(screen.getAllByRole('button', { name: /remove/i }).length).toBe(1);

    const combos = screen.getAllByRole('combobox');
    fireEvent.change(combos[0], { target: { value: 'prop-1' } });
    fireEvent.change(screen.getByLabelText('Check-in Date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Check-out Date'), { target: { value: '2026-09-03' } });

    await waitFor(() => {
      expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(3);
    });

    const roomSelect = screen.getAllByRole('combobox')[1];
    const planSelect = screen.getAllByRole('combobox')[2];

    fireEvent.change(roomSelect, { target: { value: 'room-1' } });
    fireEvent.change(planSelect, { target: { value: 'plan-1' } });

    await waitFor(() => {
      expect(screen.getByText(/GST Rate:/i).textContent).toContain('5');
    });

    fireEvent.change(screen.getAllByDisplayValue('1000')[0], { target: { value: '9000' } });

    await waitFor(() => {
      expect(screen.getByText(/GST Rate:/i).textContent).toContain('18');
    });
  });

  it('download invoice button triggers invoice API', async () => {
    const bookingServiceModule = await import('../../../src/services/bookingService');

    render(
      <MemoryRouter>
        <BookingsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download invoice/i })).toBeTruthy();
    });

    const table = screen.getByRole('table');
    fireEvent.click(within(table).getAllByRole('button', { name: /download invoice/i })[0]);

    await waitFor(() => {
      expect(bookingServiceModule.default.downloadInvoice).toHaveBeenCalledWith('booking-1');
    });
  });
});
