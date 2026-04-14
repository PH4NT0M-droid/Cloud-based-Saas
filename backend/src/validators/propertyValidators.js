const { body, param } = require('express-validator');

const PIN_CODE_REGEX = /^[0-9]{6}$/;
const MOBILE_REGEX = /^[0-9]{10}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;

const createPropertyValidator = [
  body('name').isString().trim().isLength({ min: 2, max: 150 }).withMessage('Name must be 2-150 characters'),
  body('fullAddress')
    .custom((value, { req }) => {
      if (typeof value === 'string' && value.trim().length >= 2) {
        return true;
      }

      if (typeof req.body.location === 'string' && req.body.location.trim().length >= 2) {
        return true;
      }

      throw new Error('Full address is required and must be at least 2 characters');
    }),
  body('pinCode').isString().trim().matches(PIN_CODE_REGEX).withMessage('Pin code must be exactly 6 digits'),
  body('city').isString().trim().isLength({ min: 2, max: 120 }).withMessage('City is required'),
  body('state').isString().trim().isLength({ min: 2, max: 120 }).withMessage('State is required'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be 2-200 characters'),
  body('description')
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Description must be 5-1000 characters'),
  body('mobileNumber').optional({ nullable: true, checkFalsy: true }).matches(MOBILE_REGEX).withMessage('Mobile number must be exactly 10 digits'),
  body('landlineNumber').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ min: 6, max: 20 }).withMessage('Landline number must be 6-20 characters'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('website').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Website must be a valid URL'),
  body('gstNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .toUpperCase()
    .matches(GST_REGEX)
    .withMessage('GST number must be valid'),
  body('propertyLogo').optional({ nullable: true, checkFalsy: true }).isString().trim().withMessage('Property logo must be a valid URL or path'),
  body('longDescription')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 5, max: 5000 })
    .withMessage('Long description must be 5-5000 characters'),
];

const updatePropertyValidator = [
  param('id').isUUID().withMessage('Property id must be a valid UUID'),
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage('Name must be 2-150 characters'),
  body('fullAddress')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 1000 })
    .withMessage('Full address must be 2-1000 characters'),
  body('pinCode').optional().isString().trim().matches(PIN_CODE_REGEX).withMessage('Pin code must be exactly 6 digits'),
  body('city').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('City must be 2-120 characters'),
  body('state').optional().isString().trim().isLength({ min: 2, max: 120 }).withMessage('State must be 2-120 characters'),
  body('location')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be 2-200 characters'),
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Description must be 5-1000 characters'),
  body('mobileNumber').optional({ nullable: true, checkFalsy: true }).matches(MOBILE_REGEX).withMessage('Mobile number must be exactly 10 digits'),
  body('landlineNumber').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ min: 6, max: 20 }).withMessage('Landline number must be 6-20 characters'),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Email must be valid').normalizeEmail(),
  body('website').optional({ nullable: true, checkFalsy: true }).isURL().withMessage('Website must be a valid URL'),
  body('gstNumber')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .toUpperCase()
    .matches(GST_REGEX)
    .withMessage('GST number must be valid'),
  body('propertyLogo').optional({ nullable: true, checkFalsy: true }).isString().trim().withMessage('Property logo must be a valid URL or path'),
  body('longDescription')
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 5, max: 5000 })
    .withMessage('Long description must be 5-5000 characters'),
];

const propertyIdValidator = [param('id').isUUID().withMessage('Property id must be a valid UUID')];

module.exports = {
  createPropertyValidator,
  updatePropertyValidator,
  propertyIdValidator,
};
