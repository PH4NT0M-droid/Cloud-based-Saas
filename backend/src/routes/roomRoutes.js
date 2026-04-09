const express = require('express');
const roomController = require('../controllers/roomController');
const { authenticate, authorizeRoles } = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequestMiddleware');
const {
  createRoomValidator,
  updateRoomValidator,
  listRoomsValidator,
  roomIdValidator,
} = require('../validators/roomValidators');

const router = express.Router();

router.use(authenticate);

router.post('/', authorizeRoles('ADMIN', 'MANAGER'), createRoomValidator, validateRequest, roomController.createRoomType);
router.get('/', authorizeRoles('ADMIN', 'MANAGER', 'STAFF'), listRoomsValidator, validateRequest, roomController.listRoomTypes);
router.put('/:id', authorizeRoles('ADMIN', 'MANAGER'), updateRoomValidator, validateRequest, roomController.updateRoomType);
router.delete('/:id', authorizeRoles('ADMIN', 'MANAGER'), roomIdValidator, validateRequest, roomController.deleteRoomType);

module.exports = router;
