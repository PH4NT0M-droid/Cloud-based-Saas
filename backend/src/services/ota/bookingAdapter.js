const BaseAdapter = require('./baseAdapter');

class BookingAdapter extends BaseAdapter {
  constructor() {
    super('booking');
  }

  async syncInventory(data) {
    return this.mockApiResponse({
      ota: 'booking.com',
      synced: true,
      type: 'inventory',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async syncRates(data) {
    return this.mockApiResponse({
      ota: 'booking.com',
      synced: true,
      type: 'rates',
      roomTypeId: data.roomTypeId,
      itemsSynced: data.entries.length,
    });
  }

  async fetchBookings() {
    return this.mockApiResponse({
      ota: 'booking.com',
      bookings: [
        {
          ota: 'booking.com',
          guestName: 'John Doe',
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          checkIn: '2026-08-10',
          checkOut: '2026-08-12',
        },
      ],
    });
  }
}

module.exports = BookingAdapter;
