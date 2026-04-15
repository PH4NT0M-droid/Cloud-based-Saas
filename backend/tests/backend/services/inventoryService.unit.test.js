jest.mock('../../../src/config/prisma', () => ({
  roomType: {
    findUnique: jest.fn(),
  },
  inventory: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  roomPricing: {
    updateMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../../../src/services/accessControl', () => ({
  assertRoomTypeAccess: jest.fn(),
}));

const prisma = require('../../../src/config/prisma');
const inventoryService = require('../../../src/services/inventoryService');

describe('inventoryService unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.roomType.findUnique.mockResolvedValue({
      id: 'room-1',
      property: { id: 'prop-1' },
      baseInventory: 10,
    });
  });

  it('updateInventory updates target date and does not touch pricing', async () => {
    prisma.inventory.upsert.mockResolvedValue({
      id: 'inv-1',
      roomTypeId: 'room-1',
      date: new Date('2026-08-01T00:00:00.000Z'),
      availableRooms: 7,
    });

    const result = await inventoryService.updateInventory(
      { roomTypeId: 'room-1', date: '2026-08-01', availableRooms: 7 },
      { role: 'ADMIN' },
    );

    expect(result.availableRooms).toBe(7);
    expect(prisma.inventory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ availableRooms: 7 }),
        update: expect.objectContaining({ availableRooms: 7 }),
      }),
    );
    expect(prisma.roomPricing.updateMany).not.toHaveBeenCalled();
  });

  it('bulkUpdateInventory updates all dates in range', async () => {
    const tx = {
      inventory: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([
          { id: '1', roomTypeId: 'room-1', date: new Date('2026-08-01T00:00:00.000Z'), availableRooms: 4 },
          { id: '2', roomTypeId: 'room-1', date: new Date('2026-08-02T00:00:00.000Z'), availableRooms: 4 },
          { id: '3', roomTypeId: 'room-1', date: new Date('2026-08-03T00:00:00.000Z'), availableRooms: 4 },
        ]),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await inventoryService.bulkUpdateInventory(
      {
        roomTypeId: 'room-1',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        availableRooms: 4,
      },
      { role: 'ADMIN' },
    );

    expect(result.updatedCount).toBe(3);
    expect(tx.inventory.createMany).toHaveBeenCalled();
    expect(prisma.roomPricing.updateMany).not.toHaveBeenCalled();
  });

  it('rejects negative inventory', async () => {
    await expect(
      inventoryService.updateInventory(
        { roomTypeId: 'room-1', date: '2026-08-01', availableRooms: -1 },
        { role: 'ADMIN' },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
