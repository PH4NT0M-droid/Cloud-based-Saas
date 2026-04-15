import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PropertyDetails from '../../../src/pages/PropertyDetails';

const pushToast = vi.fn();
const { roomServiceMocks, inventoryServiceMocks } = vi.hoisted(() => ({
  roomServiceMocks: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    bulkUpdate: vi.fn().mockResolvedValue({ updatedCount: 1 }),
  },
  inventoryServiceMocks: {
    update: vi.fn().mockResolvedValue({ id: 'inv-1', availableRooms: 5 }),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ propertyId: 'prop-1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../../../src/services/propertyService', () => ({
  default: {
    getOverview: vi.fn().mockResolvedValue({
      id: 'prop-1',
      name: 'Sea View',
      fullAddress: 'Goa',
      description: 'Beach property',
      managers: [{ id: 'm1', name: 'Manager One' }],
      roomTypes: [
        {
          id: 'room-1',
          name: 'Deluxe',
          baseCapacity: 2,
          maxCapacity: 4,
          baseInventory: 8,
          inventories: [{ id: 'inv-1', date: '2026-09-01', availableRooms: 6 }],
          ratePlans: [
            { id: 'plan-1', mealPlanName: 'EP', isDefault: true },
            { id: 'plan-2', mealPlanName: 'CP', isDefault: false },
          ],
          roomPricings: [{ date: '2026-09-01', ratePlanId: 'plan-1', price: 1200 }],
        },
      ],
    }),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../../src/services/inventoryService', () => ({
  default: inventoryServiceMocks,
}));

vi.mock('../../../src/services/roomService', () => ({
  default: roomServiceMocks,
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  default: () => ({ user: { role: 'ADMIN', permissions: { canManageProperties: true } } }),
}));

vi.mock('../../../src/components/ToastProvider', () => ({
  useToast: () => ({ pushToast }),
}));

vi.mock('../../../src/components/Modal', () => ({
  default: ({ open, title, children }) => (open ? <section><h3>{title}</h3>{children}</section> : null),
}));

vi.mock('../../../src/components/InventoryGrid', () => ({
  default: ({ roomTypes, dates, onSave }) => (
    <section>
      <p>Inventory grid mocked</p>
      <p>inventory-room-count:{roomTypes.length}</p>
      <p>inventory-date-count:{dates.length}</p>
      <button onClick={() => onSave({ roomTypeId: 'room-1', date: dates[0], availableRooms: 5 })}>save inventory cell</button>
    </section>
  ),
}));

vi.mock('../../../src/components/PricingGrid', () => ({
  default: ({ roomTypes, dates, onSave }) => (
    <section>
      <p>Pricing grid mocked</p>
      <p>pricing-room-count:{roomTypes.length}</p>
      <p>pricing-date-count:{dates.length}</p>
      <button onClick={() => onSave({ roomTypeId: 'room-1', ratePlanId: 'plan-1', date: dates[0], price: 1500 })}>save pricing cell</button>
    </section>
  ),
}));

describe('PropertyDetails critical flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders pricing and inventory grids with room/rate-plan data and supports inline saves', async () => {
    render(
      <MemoryRouter>
        <PropertyDetails />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Property workspace')).toBeTruthy();
    });

    expect(screen.getByText('Inventory grid mocked')).toBeTruthy();
    expect(screen.getByText('Pricing grid mocked')).toBeTruthy();
    expect(screen.getByText(/inventory-room-count:1/i)).toBeTruthy();
    expect(screen.getByText(/pricing-room-count:1/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /save inventory cell/i }));
    fireEvent.click(screen.getByRole('button', { name: /save pricing cell/i }));

    await waitFor(() => {
      expect(inventoryServiceMocks.update).toHaveBeenCalled();
      expect(roomServiceMocks.bulkUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roomTypeId: 'room-1',
          type: 'price',
          ratePlanId: 'plan-1',
          applyToAll: false,
        }),
      );
    });
  });

  it('bulk update modal toggles meal-plan field by mode and sends ALL plan payload', async () => {
    render(
      <MemoryRouter>
        <PropertyDetails />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /bulk update/i })).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /bulk update/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('Bulk update rates or inventory')).toBeTruthy();
      expect(screen.getByText('Meal plan')).toBeTruthy();
    });

    const typeSelect = screen.getByDisplayValue('Price');
    fireEvent.change(typeSelect, { target: { value: 'inventory' } });

    await waitFor(() => {
      expect(screen.queryByText('Meal plan')).toBeNull();
    });

    fireEvent.change(typeSelect, { target: { value: 'price' } });
    fireEvent.change(screen.getByLabelText('Room type'), { target: { value: 'room-1' } });
    fireEvent.change(screen.getByLabelText('Meal plan'), { target: { value: 'ALL' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: '2500' } });

    fireEvent.click(screen.getByRole('button', { name: /apply bulk update/i }));

    await waitFor(() => {
      expect(roomServiceMocks.bulkUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          roomTypeId: 'room-1',
          type: 'price',
          ratePlanId: 'ALL',
          applyToAll: true,
          value: 2500,
        }),
      );
    });
  });
});
