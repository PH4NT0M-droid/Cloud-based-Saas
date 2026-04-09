const BaseAdapter = require('./baseAdapter');

class AirbnbAdapter extends BaseAdapter {
  constructor() {
    super('airbnb');
  }

  async syncInventory(data) {
    return this.mockApiResponse({
      ota: 'airbnb',
      synced: true,
      type: 'inventory',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async syncRates(data) {
    return this.mockApiResponse({
      ota: 'airbnb',
      synced: true,
      type: 'rates',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async fetchBookings() {
    return this.mockApiResponse({
      ota: 'airbnb',
      bookings: [
        {
          ota: 'airbnb',
          guestName: 'Mia Santos',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          checkIn: '2026-08-15',
          checkOut: '2026-08-17',
        },
      ],
    });
  }
}

module.exports = AirbnbAdapter;
