const express = require('express');
const authRoutes = require('./authRoutes');
const adminRoutes = require('./adminRoutes');
const healthRoutes = require('./healthRoutes');
const propertyRoutes = require('./propertyRoutes');
const roomRoutes = require('./roomRoutes');
const inventoryRoutes = require('./inventoryRoutes');
const rateRoutes = require('./rateRoutes');
const pricingRoutes = require('./pricingRoutes');
const otaRoutes = require('./otaRoutes');
const bookingRoutes = require('./bookingRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const promotionRoutes = require('./promotionRoutes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/properties', propertyRoutes);
router.use('/rooms', roomRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/rates', rateRoutes);
router.use('/pricing', pricingRoutes);
router.use('/ota', otaRoutes);
router.use('/bookings', bookingRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/promotions', promotionRoutes);

module.exports = router;
