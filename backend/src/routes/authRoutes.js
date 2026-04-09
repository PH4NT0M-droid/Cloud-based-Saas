const express = require('express');
const authController = require('../controllers/authController');
const validate = require('../middlewares/validateMiddleware');
const { loginSchema } = require('../validators/authValidators');

const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);

module.exports = router;
