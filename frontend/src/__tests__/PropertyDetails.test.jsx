import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PropertyDetails from '../pages/PropertyDetails';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ propertyId: 'prop-1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/propertyService', () => ({
  default: {
    getOverview: vi.fn().mockResolvedValue({
      id: 'prop-1',
      name: 'Sea View Stays',
      location: 'Goa',
      description: 'Beachside property',
      managers: [{ id: 'manager-1', name: 'Manager One' }],
      roomTypes: [
        {
          id: 'room-1',
          name: 'Deluxe',
          maxOccupancy: 3,
          inventories: [],
          rates: [],
        },
      ],
    }),
  },
}));

vi.mock('../services/inventoryService', () => ({
  default: {
    update: vi.fn(),
  },
}));

vi.mock('../services/rateService', () => ({
  default: {
    update: vi.fn(),
  },
}));

vi.mock('../services/roomService', () => ({
  default: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    pushToast: vi.fn(),
  }),
}));

describe('PropertyDetails page', () => {
  it('renders room, inventory and pricing sections', async () => {
    render(
      <MemoryRouter>
        <PropertyDetails />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Property workspace')).toBeTruthy();
    });

    expect(screen.getByText('Room management')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add room/i })).toBeTruthy();
    expect(screen.getByText('Inventory grid')).toBeTruthy();
    expect(screen.getByText('Pricing grid')).toBeTruthy();
  });
});
