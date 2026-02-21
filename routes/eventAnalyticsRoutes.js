const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const { body, param } = require('express-validator');
const EventAnalyticsService = require('../services/eventAnalyticsService');

const router = express.Router();

// Track event view
router.post('/:eventId/track-view',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { source = 'direct', device = 'desktop', location = {} } = req.body;
      
      const result = await EventAnalyticsService.trackView(eventId, {
        source,
        device,
        location
      });
      
      res.json({
        success: true,
        message: 'View tracked successfully',
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

// Track event registration
router.post('/:eventId/track-registration',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const result = await EventAnalyticsService.trackRegistration(eventId);
      
      res.json({
        success: true,
        message: 'Registration tracked successfully',
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

// Track event check-in
router.post('/:eventId/track-checkin',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId } = req.body;
      
      const result = await EventAnalyticsService.trackCheckIn(eventId, userId);
      
      res.json({
        success: true,
        message: 'Check-in tracked successfully',
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

// Track engagement
router.post('/:eventId/track-engagement',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  [
    body('action')
      .isIn(['likes', 'shares', 'comments', 'bookmarks'])
      .withMessage('Invalid engagement action'),
    body('count')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Count must be a positive integer')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { action, count = 1 } = req.body;
      
      const result = await EventAnalyticsService.trackEngagement(eventId, action, count);
      
      res.json({
        success: true,
        message: 'Engagement tracked successfully',
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

// Get event analytics
router.get('/:eventId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const result = await EventAnalyticsService.getEventAnalytics(eventId);
      
      res.json({
        success: true,
        data: result.analytics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get dashboard analytics
router.get('/dashboard/:organizerId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('organizerId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { organizerId } = req.params;
      const { startDate, endDate, limit = 10 } = req.query;
      
      // Check if user can access this organizer's analytics
      if (req.auth.userId !== organizerId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const result = await EventAnalyticsService.getDashboardAnalytics(organizerId, {
        startDate,
        endDate,
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate analytics report
router.get('/:eventId/report',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { format = 'json' } = req.query;
      
      const result = await EventAnalyticsService.generateReport(eventId, format);
      
      if (format === 'json') {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="event-analytics.${format}"`);
        res.send(result.data);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;