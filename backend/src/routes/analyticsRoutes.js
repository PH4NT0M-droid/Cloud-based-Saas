const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles('ADMIN', 'MANAGER', 'STAFF'));

router.get('/revenue', analyticsController.getRevenueAnalytics);
router.get('/occupancy', analyticsController.getOccupancyAnalytics);
router.get('/ota-performance', analyticsController.getOtaPerformance);
router.get('/metrics', analyticsController.getMetrics);

module.exports = router;
