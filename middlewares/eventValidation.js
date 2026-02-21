const { body } = require('express-validator');

// Event-specific validations
const eventValidations = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Event title must be 3-200 characters long'),
    
    body('description')
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Event description must be 10-5000 characters long'),
    
    body('location')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Event location must be 3-200 characters long'),
    
    body('startDateTime')
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    
    body('endDateTime')
      .isISO8601()
      .withMessage('End date must be a valid date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDateTime)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    
    body('capacity')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Capacity must be between 1 and 10000'),
    
    body('category')
      .isMongoId()
      .withMessage('Category must be a valid MongoDB ObjectId'),
    
    body('tags')
      .isArray({ min: 0, max: 10 })
      .withMessage('Tags must be an array with 0-10 items'),
    
    body('tags.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be 1-50 characters long'),
    
    body('imageUrl')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Image URL must be a valid URL'),
    
    body('isOnline')
      .optional()
      .isBoolean()
      .withMessage('isOnline must be a boolean value'),
    
    body('isFree')
      .optional()
      .isBoolean()
      .withMessage('isFree must be a boolean value'),
    
    body('url')
      .optional()
      .custom((value) => {
        if (value === '' || value === null || value === undefined) {
          return true;
        }
        return /^https?:\/\/.+/.test(value);
      })
      .withMessage('URL must be a valid URL or empty'),
    
    body('meetingLink')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Meeting link must be a valid URL')
  ],

  update: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Event title must be 3-200 characters long'),
    
    body('description')
      .optional()
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Event description must be 10-5000 characters long'),
    
    body('location')
      .optional()
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Event location must be 3-200 characters long'),
    
    body('startDateTime')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid date'),
    
    body('endDateTime')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid date'),
    
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    
    body('capacity')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Capacity must be between 1 and 10000'),
    
    body('category')
      .optional()
      .isMongoId()
      .withMessage('Category must be a valid MongoDB ObjectId'),
    
    body('tags')
      .optional()
      .isArray({ min: 0, max: 10 })
      .withMessage('Tags must be an array with 0-10 items'),
    
    body('tags.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Each tag must be 1-50 characters long'),
    
    body('imageUrl')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Image URL must be a valid URL'),
    
    body('isOnline')
      .optional()
      .isBoolean()
      .withMessage('isOnline must be a boolean value'),
    
    body('isFree')
      .optional()
      .isBoolean()
      .withMessage('isFree must be a boolean value'),
    
    body('url')
      .optional()
      .custom((value) => {
        if (value === '' || value === null || value === undefined) {
          return true;
        }
        return /^https?:\/\/.+/.test(value);
      })
      .withMessage('URL must be a valid URL or empty'),
    
    body('meetingLink')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Meeting link must be a valid URL')
  ]
};

module.exports = { eventValidations };