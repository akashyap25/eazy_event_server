const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const { body, param } = require('express-validator');
const RecurringEventService = require('../services/recurringEventService');

const router = express.Router();

// Validation middleware for recurring events
const validateRecurringPattern = [
  body('recurringPattern.type')
    .isIn(['daily', 'weekly', 'monthly', 'yearly', 'custom'])
    .withMessage('Invalid recurring type'),
  body('recurringPattern.interval')
    .isInt({ min: 1 })
    .withMessage('Interval must be at least 1'),
  body('recurringPattern.daysOfWeek')
    .optional()
    .isArray()
    .withMessage('Days of week must be an array'),
  body('recurringPattern.dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 31 })
    .withMessage('Day of month must be between 1 and 31'),
  body('recurringPattern.endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date'),
  body('recurringPattern.occurrences')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Occurrences must be between 1 and 1000')
];

// Create recurring events
router.post('/create', 
  authenticateToken, 
  requireAuth,
  validateRecurringPattern,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventData, recurringPattern } = req.body;
      const userId = req.auth.userId;
      
      // Validate recurring pattern
      const validation = RecurringEventService.validateRecurringPattern(recurringPattern);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recurring pattern',
          errors: validation.errors
        });
      }
      
      // Add organizer to event data
      eventData.organizer = userId;
      
      // Create recurring events
      const result = await RecurringEventService.createRecurringEvents(eventData, recurringPattern);
      
      res.status(201).json({
        success: true,
        message: 'Recurring events created successfully',
        data: {
          parentEvent: result.parentEvent,
          instancesCreated: result.instances.length,
          totalCreated: result.totalCreated
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get recurring event instances
router.get('/:recurringGroupId/instances',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('recurringGroupId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { recurringGroupId } = req.params;
      const { startDate, endDate } = req.query;
      
      const instances = await RecurringEventService.getRecurringInstances(recurringGroupId, {
        startDate,
        endDate
      });
      
      res.json({
        success: true,
        data: instances
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update recurring events
router.put('/:recurringGroupId/update',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('recurringGroupId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { recurringGroupId } = req.params;
      const { eventId, scope = 'this', updateData } = req.body;
      
      const result = await RecurringEventService.updateRecurringEvents(
        recurringGroupId,
        { eventId, ...updateData },
        scope
      );
      
      res.json({
        success: true,
        message: 'Recurring events updated successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Delete recurring events
router.delete('/:recurringGroupId/delete',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('recurringGroupId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { recurringGroupId } = req.params;
      const { eventId, scope = 'this' } = req.body;
      
      const result = await RecurringEventService.deleteRecurringEvents(
        recurringGroupId,
        scope,
        eventId
      );
      
      res.json({
        success: true,
        message: 'Recurring events deleted successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Validate recurring pattern
router.post('/validate-pattern',
  authenticateToken,
  requireAuth,
  validateRecurringPattern,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { recurringPattern } = req.body;
      
      const validation = RecurringEventService.validateRecurringPattern(recurringPattern);
      
      res.json({
        success: true,
        data: validation
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;