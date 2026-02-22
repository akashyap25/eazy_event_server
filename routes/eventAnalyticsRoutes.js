const express = require('express');
const mongoose = require('mongoose');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const { body, param } = require('express-validator');
const EventAnalyticsService = require('../services/eventAnalyticsService');
const { requireOrganization, requireOrgPermission } = require('../middlewares/organizationMiddleware');
const Event = require('../models/event');
const Order = require('../models/order');
const Task = require('../models/task');
const OrganizationMember = require('../models/organizationMember');

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

// Organization-wide analytics
router.get('/organization/:orgId',
  authenticateToken,
  requireAuth,
  async (req, res, next) => {
    req.headers['x-organization-id'] = req.params.orgId;
    next();
  },
  requireOrganization,
  requireOrgPermission('view_analytics'),
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const { startDate, endDate, period = '30d' } = req.query;
      
      // Calculate date range
      const end = endDate ? new Date(endDate) : new Date();
      let start;
      if (startDate) {
        start = new Date(startDate);
      } else {
        const days = parseInt(period.replace('d', '')) || 30;
        start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      }
      
      const orgObjectId = new mongoose.Types.ObjectId(orgId);
      
      // Get organization events
      const events = await Event.find({
        organizationId: orgObjectId,
        isDeleted: { $ne: true },
        createdAt: { $gte: start, $lte: end }
      });
      
      const eventIds = events.map(e => e._id);
      
      // Calculate metrics
      const [
        totalEvents,
        totalAttendees,
        totalRevenue,
        totalTasks,
        completedTasks,
        memberCount
      ] = await Promise.all([
        Event.countDocuments({ organizationId: orgObjectId, isDeleted: { $ne: true } }),
        Event.aggregate([
          { $match: { organizationId: orgObjectId, isDeleted: { $ne: true } } },
          { $project: { attendeeCount: { $size: { $ifNull: ['$attendees', []] } } } },
          { $group: { _id: null, total: { $sum: '$attendeeCount' } } }
        ]),
        Order.aggregate([
          { $match: { organizationId: orgObjectId, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Task.countDocuments({ organizationId: orgObjectId, isDeleted: { $ne: true } }),
        Task.countDocuments({ organizationId: orgObjectId, status: 'completed', isDeleted: { $ne: true } }),
        OrganizationMember.countDocuments({ organization: orgObjectId, status: 'active' })
      ]);
      
      // Events by status
      const eventsByStatus = await Event.aggregate([
        { $match: { organizationId: orgObjectId, isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      // Events by category
      const eventsByCategory = await Event.aggregate([
        { $match: { organizationId: orgObjectId, isDeleted: { $ne: true } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ['$category.name', 'Uncategorized'] }, count: 1 } }
      ]);
      
      // Events trend (by day/week)
      const eventsTrend = await Event.aggregate([
        { $match: { organizationId: orgObjectId, isDeleted: { $ne: true }, createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Revenue trend
      const revenueTrend = await Order.aggregate([
        { $match: { organizationId: orgObjectId, status: 'completed', createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            amount: { $sum: '$totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      // Top performing events
      const topEvents = await Event.find({ organizationId: orgObjectId, isDeleted: { $ne: true } })
        .sort({ 'analytics.views': -1 })
        .limit(5)
        .select('title analytics.views analytics.registrations analytics.checkIns startDateTime');
      
      res.json({
        success: true,
        data: {
          overview: {
            totalEvents,
            totalAttendees: totalAttendees[0]?.total || 0,
            totalRevenue: totalRevenue[0]?.total || 0,
            totalTasks,
            completedTasks,
            taskCompletionRate: totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : 0,
            memberCount
          },
          eventsByStatus: eventsByStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
          eventsByCategory,
          trends: {
            events: eventsTrend,
            revenue: revenueTrend
          },
          topEvents,
          period: { start, end }
        }
      });
    } catch (error) {
      console.error('Organization analytics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Organization comparison analytics
router.get('/organization/:orgId/compare',
  authenticateToken,
  requireAuth,
  async (req, res, next) => {
    req.headers['x-organization-id'] = req.params.orgId;
    next();
  },
  requireOrganization,
  requireOrgPermission('view_analytics'),
  async (req, res) => {
    try {
      const { orgId } = req.params;
      const { period = '30d' } = req.query;
      
      const days = parseInt(period.replace('d', '')) || 30;
      const currentEnd = new Date();
      const currentStart = new Date(currentEnd.getTime() - days * 24 * 60 * 60 * 1000);
      const previousEnd = new Date(currentStart.getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - days * 24 * 60 * 60 * 1000);
      
      const orgObjectId = new mongoose.Types.ObjectId(orgId);
      
      const getMetrics = async (start, end) => {
        const [events, revenue, attendees] = await Promise.all([
          Event.countDocuments({
            organizationId: orgObjectId,
            isDeleted: { $ne: true },
            createdAt: { $gte: start, $lte: end }
          }),
          Order.aggregate([
            { $match: { organizationId: orgObjectId, status: 'completed', createdAt: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]),
          Event.aggregate([
            { $match: { organizationId: orgObjectId, isDeleted: { $ne: true }, createdAt: { $gte: start, $lte: end } } },
            { $project: { count: { $size: { $ifNull: ['$attendees', []] } } } },
            { $group: { _id: null, total: { $sum: '$count' } } }
          ])
        ]);
        
        return {
          events,
          revenue: revenue[0]?.total || 0,
          attendees: attendees[0]?.total || 0
        };
      };
      
      const [current, previous] = await Promise.all([
        getMetrics(currentStart, currentEnd),
        getMetrics(previousStart, previousEnd)
      ]);
      
      const calculateChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return (((current - previous) / previous) * 100).toFixed(1);
      };
      
      res.json({
        success: true,
        data: {
          current,
          previous,
          changes: {
            events: calculateChange(current.events, previous.events),
            revenue: calculateChange(current.revenue, previous.revenue),
            attendees: calculateChange(current.attendees, previous.attendees)
          },
          periods: {
            current: { start: currentStart, end: currentEnd },
            previous: { start: previousStart, end: previousEnd }
          }
        }
      });
    } catch (error) {
      console.error('Comparison analytics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;