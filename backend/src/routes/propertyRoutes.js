const express = require('express');
const propertyController = require('../controllers/propertyController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  createPropertyValidator,
  updatePropertyValidator,
  propertyIdValidator,
} = require('../validators/propertyValidators');

const router = express.Router();

router.use(authenticate);

router.post('/', authorizeRoles('ADMIN'), createPropertyValidator, validateRequest, propertyController.createProperty);
router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), propertyController.listProperties);
router.get('/:id/overview', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), propertyIdValidator, validateRequest, propertyController.getPropertyOverview);
router.get('/:id', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), propertyIdValidator, validateRequest, propertyController.getPropertyById);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updatePropertyValidator, validateRequest, propertyController.updateProperty);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), propertyIdValidator, validateRequest, propertyController.deleteProperty);

module.exports = router;
