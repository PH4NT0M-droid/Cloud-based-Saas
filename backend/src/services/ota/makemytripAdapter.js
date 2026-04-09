const BaseAdapter = require('./baseAdapter');

class MakeMyTripAdapter extends BaseAdapter {
  constructor() {
    super('makemytrip');
  }

  async syncInventory(data) {
    return this.mockApiResponse({
      ota: 'makemytrip',
      synced: true,
      type: 'inventory',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async syncRates(data) {
    return this.mockApiResponse({
      ota: 'makemytrip',
      synced: true,
      type: 'rates',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async fetchBookings() {
    return this.mockApiResponse({
      ota: 'makemytrip',
      bookings: [
        {
          ota: 'makemytrip',
          guestName: 'Arjun Malhotra',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          checkIn: '2026-08-20',
          checkOut: '2026-08-22',
        },
      ],
    });
  }
}

module.exports = MakeMyTripAdapter;
