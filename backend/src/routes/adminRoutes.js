const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  createManagerValidator,
  updateManagerValidator,
  deleteManagerValidator,
  assignPropertyValidator,
  removePropertyValidator,
} = require('../validators/adminValidators');

const router = express.Router();

router.use(authenticate, authorizeRoles('ADMIN'));

router.get('/users', adminController.listUsers);
router.post('/users', createManagerValidator, validateRequest, adminController.createManager);
router.put('/users/:id', updateManagerValidator, validateRequest, adminController.updateManager);
router.delete('/users/:id', deleteManagerValidator, validateRequest, adminController.deleteManager);
router.post('/assign-property', assignPropertyValidator, validateRequest, adminController.assignProperty);
router.delete('/remove-property', removePropertyValidator, validateRequest, adminController.removeProperty);

module.exports = router;