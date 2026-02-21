/**
 * Centralized Validation Utilities
 * Consolidates all validation patterns to eliminate duplication
 */

const { body, param, query, validationResult } = require('express-validator');
const { validatePassword } = require('../config/security');

// Common validation rules
const commonValidations = {
  // MongoDB ObjectId validation
  mongoId: (field) => param(field)
    .isMongoId()
    .withMessage(`${field} must be a valid MongoDB ObjectId`),

  // Email validation
  email: (field = 'email') => body(field)
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Please provide a valid email address'),

  // Password validation
  password: (field = 'password') => body(field)
    .custom((value) => {
      const validation = validatePassword(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),

  // Username validation
  username: (field = 'username') => body(field)
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),

  // Name validation
  name: (field, min = 1, max = 50) => body(field)
    .trim()
    .isLength({ min, max })
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${field} must be ${min}-${max} characters and contain only letters, spaces, hyphens, and apostrophes`),

  // URL validation
  url: (field = 'url') => body(field)
    .optional()
    .isURL({ protocols: ['http', 'https'] })
    .isLength({ max: 2048 })
    .withMessage('Please provide a valid URL'),

  // Phone validation
  phone: (field = 'phone') => body(field)
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number'),

  // Date validation
  date: (field) => body(field)
    .isISO8601()
    .withMessage(`${field} must be a valid date`),

  // Positive number validation
  positiveNumber: (field, min = 0) => body(field)
    .isFloat({ min })
    .withMessage(`${field} must be a positive number`),

  // Integer validation
  integer: (field, min = 0) => body(field)
    .isInt({ min })
    .withMessage(`${field} must be a valid integer`),

  // Boolean validation
  boolean: (field) => body(field)
    .isBoolean()
    .withMessage(`${field} must be a boolean value`),

  // Array validation
  array: (field) => body(field)
    .isArray()
    .withMessage(`${field} must be an array`),

  // String length validation
  stringLength: (field, min = 1, max = 255) => body(field)
    .isLength({ min, max })
    .withMessage(`${field} must be between ${min} and ${max} characters`)
};

// Predefined validation sets
const validationSets = {
  // User registration validation
  registration: [
    commonValidations.email(),
    commonValidations.password(),
    commonValidations.username(),
    commonValidations.name('firstName'),
    commonValidations.name('lastName')
  ],

  // User login validation
  login: [
    commonValidations.email(),
    body('password').notEmpty().withMessage('Password is required')
  ],

  // Password change validation
  passwordChange: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    commonValidations.password('newPassword'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
  ],

  // Event creation validation
  eventCreation: [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required and must be less than 100 characters'),
    body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Description is required and must be less than 1000 characters'),
    body('location').trim().isLength({ min: 1, max: 200 }).withMessage('Location is required and must be less than 200 characters'),
    commonValidations.date('startDateTime'),
    commonValidations.date('endDateTime'),
    commonValidations.positiveNumber('price'),
    commonValidations.integer('capacity', 1),
    commonValidations.url('imageUrl'),
    commonValidations.url('url')
  ],

  // Task creation validation
  taskCreation: [
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('priority').isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
    body('status').isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid status'),
    commonValidations.date('dueDate')
  ]
};

// Error response helper
const createErrorResponse = (statusCode, message, errors = []) => ({
  success: false,
  message,
  ...(errors.length > 0 && { errors })
});

// Success response helper
const createSuccessResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data
});

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(createErrorResponse(
      400,
      'Validation failed',
      errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    ));
  }
  next();
};

// Sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .substring(0, 10000); // Limit string length
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = {
  commonValidations,
  validationSets,
  handleValidationErrors,
  sanitizeInput,
  createErrorResponse,
  createSuccessResponse
};
