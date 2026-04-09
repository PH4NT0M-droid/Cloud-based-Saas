const BaseAdapter = require('./baseAdapter');

class AgodaAdapter extends BaseAdapter {
  constructor() {
    super('agoda');
  }

  async syncInventory(data) {
    return this.mockApiResponse({
      ota: 'agoda',
      synced: true,
      type: 'inventory',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async syncRates(data) {
    return this.mockApiResponse({
      ota: 'agoda',
      synced: true,
      type: 'rates',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async fetchBookings() {
    return this.mockApiResponse({
      ota: 'agoda',
      bookings: [
        {
          ota: 'agoda',
          guestName: 'Liam Wong',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          checkIn: '2026-08-23',
          checkOut: '2026-08-25',
        },
      ],
    });
  }
}

module.exports = AgodaAdapter;
