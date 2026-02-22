const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const pushNotificationService = require('../services/pushNotificationService');
const Notification = require('../models/notification');

const router = express.Router();

// Get in-app notifications for current user
router.get('/',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const notifications = await Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      res.json({ success: true, data: notifications || [] });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Mark one notification as read
router.put('/:id/read',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const n = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
      if (!n) return res.status(404).json({ success: false, message: 'Notification not found' });
      await n.markAsRead();
      res.json({ success: true, data: n });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Mark all as read
router.put('/read-all',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      await Notification.markAllAsRead(req.user._id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Delete a notification
router.delete('/:id',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const result = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
      if (!result) return res.status(404).json({ success: false, message: 'Notification not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// Subscribe to push notifications
router.post('/subscribe',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { subscription } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({
          success: false,
          message: 'Invalid subscription object'
        });
      }

      const result = await pushNotificationService.subscribeUser(req.user._id, subscription);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Unsubscribe from push notifications
router.post('/unsubscribe',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Endpoint is required'
        });
      }

      const result = await pushNotificationService.unsubscribeUser(req.user._id, endpoint);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get VAPID public key
router.get('/vapid-key',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const publicKey = pushNotificationService.getVapidPublicKey();

      res.json({
        success: true,
        data: {
          publicKey
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

// Test push notification
router.post('/test',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const result = await pushNotificationService.testNotification(req.user._id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send event notification (admin only)
router.post('/event/:eventId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { type, title, body, data } = req.body;

      // Check if user is event organizer or admin
      const Event = require('../models/event');
      const event = await Event.findById(eventId);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only event organizer can send notifications.'
        });
      }

      const result = await pushNotificationService.sendEventNotification(eventId, type, {
        title,
        body,
        data
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send system notification (admin only)
router.post('/system',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      const { userIds, notification } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'User IDs array is required'
        });
      }

      const result = await pushNotificationService.sendSystemNotification(userIds, notification);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send chat notification
router.post('/chat/:roomId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { message, recipientIds } = req.body;

      if (!message || !recipientIds || !Array.isArray(recipientIds)) {
        return res.status(400).json({
          success: false,
          message: 'Message and recipient IDs are required'
        });
      }

      const result = await pushNotificationService.sendChatNotification(
        roomId,
        req.user._id,
        message,
        recipientIds
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

module.exports = router;