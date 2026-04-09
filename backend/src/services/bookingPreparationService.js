const otaService = require('./ota/otaService');

const normalizeOtaBooking = (booking) => ({
  otaSource: booking.ota,
  guestName: booking.guestName,
  roomTypeId: booking.roomTypeId,
  checkIn: booking.checkIn,
  checkOut: booking.checkOut,
  status: booking.status || 'CONFIRMED',
});

const fetchAndNormalizeOtaBookings = async (otas) => {
  const result = await otaService.fetchAllBookings(otas);
  const normalized = result.bookings.map(normalizeOtaBooking);

  return {
    ...result,
    normalizedBookings: normalized,
  };
};

module.exports = {
  normalizeOtaBooking,
  fetchAndNormalizeOtaBookings,
};
