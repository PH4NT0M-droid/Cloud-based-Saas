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

const createManualBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createManualBooking(req.body, req.user);
    return res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

const updateBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.updateBooking(req.params.id, req.body, req.user);
    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

const previewInvoice = async (req, res, next) => {
  try {
    const html = await bookingService.getInvoiceHtml(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: { html },
    });
  } catch (error) {
    return next(error);
  }
};

const getInvoice = async (req, res, next) => {
  try {
    const pdfBuffer = await bookingService.getInvoicePdfBuffer(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${req.params.id}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return next(error);
  }
};

const cancelBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.updateBookingStatus(req.params.id, 'CANCELLED', req.user);
    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    return next(error);
  }
};

const deleteBooking = async (req, res, next) => {
  try {
    const result = await bookingService.deleteBooking(req.params.id, req.user);
    return res.status(200).json({
      success: true,
      data: result,
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
  createManualBooking,
  updateBooking,
  previewInvoice,
  getInvoice,
  cancelBooking,
  deleteBooking,
  syncBookings,
};
