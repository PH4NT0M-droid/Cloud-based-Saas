const express = require('express');
const promotionController = require('../controllers/promotionController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  createPromotionValidator,
  updatePromotionValidator,
  deletePromotionValidator,
} = require('../validators/promotionValidators');

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), promotionController.listPromotions);
router.post('/', authorizeRoles('ADMIN', 'MANAGER'), createPromotionValidator, validateRequest, promotionController.createPromotion);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updatePromotionValidator, validateRequest, promotionController.updatePromotion);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), deletePromotionValidator, validateRequest, promotionController.deletePromotion);

module.exports = router;
