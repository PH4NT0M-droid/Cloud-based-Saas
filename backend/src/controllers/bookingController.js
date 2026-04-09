const bookingService = require('../services/bookingService');

const listBookings = async (req, res, next) => {
  try {
    const bookings = await bookingService.listBookings(req.user, req.query);
    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    return next(error);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    const booking = await bookingService.updateBookingStatus(req.params.id, req.body.status, req.user);
    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

const syncBookings = async (req, res, next) => {
  try {
    const result = await bookingService.syncBookingsFromOtas(req.body.otas, req.user);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listBookings,
  getBookingById,
  updateBookingStatus,
  syncBookings,
};
