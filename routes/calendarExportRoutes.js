const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const CalendarExportService = require('../services/calendarExportService');
const Event = require('../models/event');

const router = express.Router();

// Get calendar export options for single event
router.get('/:eventId',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { timezone = 'UTC' } = req.query;
      
      const event = await Event.findById(eventId)
        .populate('organizer', 'username firstName lastName email')
        .populate('category', 'name');
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      const result = CalendarExportService.generateAllCalendarExports(event, { timezone });
      
      res.json({
        success: true,
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

// Download iCal file
router.get('/:eventId/ical',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { timezone = 'UTC' } = req.query;
      
      const event = await Event.findById(eventId)
        .populate('organizer', 'username firstName lastName email')
        .populate('category', 'name');
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      const icalContent = CalendarExportService.generateICal(event, { timezone });
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
      res.send(icalContent);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get Google Calendar URL
router.get('/:eventId/google',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      const googleUrl = CalendarExportService.generateGoogleCalendarUrl(event);
      
      res.json({
        success: true,
        data: {
          url: googleUrl,
          name: 'Google Calendar'
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

// Get Outlook Calendar URL
router.get('/:eventId/outlook',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      const outlookUrl = CalendarExportService.generateOutlookCalendarUrl(event);
      
      res.json({
        success: true,
        data: {
          url: outlookUrl,
          name: 'Outlook Calendar'
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

// Get Yahoo Calendar URL
router.get('/:eventId/yahoo',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }
      
      const yahooUrl = CalendarExportService.generateYahooCalendarUrl(event);
      
      res.json({
        success: true,
        data: {
          url: yahooUrl,
          name: 'Yahoo Calendar'
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

// Bulk export for multiple events
router.post('/bulk/ical',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { eventIds, timezone = 'UTC', calendarName = 'Eazy Event Calendar' } = req.body;
      
      if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Event IDs array is required'
        });
      }
      
      const events = await Event.find({ _id: { $in: eventIds } })
        .populate('organizer', 'username firstName lastName email')
        .populate('category', 'name');
      
      if (events.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No events found'
        });
      }
      
      const icalContent = CalendarExportService.generateBulkICal(events, { 
        timezone, 
        calendarName 
      });
      
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="events.ics"');
      res.send(icalContent);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get user's events for bulk export
router.get('/user/:userId/events',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('userId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate, status } = req.query;
      
      // Check if user can access this user's events
      if (req.auth.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      const query = { organizer: userId };
      
      if (startDate) {
        query.startDateTime = { $gte: new Date(startDate) };
      }
      if (endDate) {
        query.startDateTime = { 
          ...query.startDateTime,
          $lte: new Date(endDate)
        };
      }
      if (status) {
        query.status = status;
      }
      
      const events = await Event.find(query)
        .populate('category', 'name')
        .sort({ startDateTime: 1 })
        .select('title description location startDateTime endDateTime status');
      
      res.json({
        success: true,
        data: events
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