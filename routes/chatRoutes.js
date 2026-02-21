const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const ChatService = require('../services/chatService');
const { ChatRoom, Message } = require('../models/chat');

const router = express.Router();

// Create chat room for an event
router.post('/rooms',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId, name, description, type, isPrivate, settings } = req.body;
      
      const chatRoom = await ChatService.createChatRoom(eventId, req.user._id, {
        name,
        description,
        type,
        isPrivate,
        settings
      });

      res.status(201).json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get chat rooms for an event
router.get('/events/:eventId/rooms',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const chatRooms = await ChatService.getEventChatRooms(eventId, req.user._id);

      res.json({
        success: true,
        data: chatRooms
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get specific chat room
router.get('/rooms/:roomId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      
      const chatRoom = await ChatService.getChatRoomById(roomId);

      // Check if user is participant
      if (!chatRoom.isParticipant(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a participant in this room.'
        });
      }

      res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Join chat room
router.post('/rooms/:roomId/join',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { role = 'member' } = req.body;
      
      const chatRoom = await ChatService.joinChatRoom(roomId, req.user._id, role);

      res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Leave chat room
router.post('/rooms/:roomId/leave',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      
      const chatRoom = await ChatService.leaveChatRoom(roomId, req.user._id);

      res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get messages for a chat room
router.get('/rooms/:roomId/messages',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { page = 1, limit = 50, before, after } = req.query;

      // Check if user is participant
      const chatRoom = await ChatService.getChatRoomById(roomId);
      if (!chatRoom.isParticipant(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You are not a participant in this room.'
        });
      }

      const messages = await ChatService.getChatRoomMessages(roomId, {
        page: parseInt(page),
        limit: parseInt(limit),
        before,
        after
      });

      res.json({
        success: true,
        data: messages
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Send message (for REST API - Socket.IO is preferred)
router.post('/rooms/:roomId/messages',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { content, messageType = 'text', replyTo, mentions = [] } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message content cannot be empty'
        });
      }

      const message = await ChatService.sendMessage(roomId, req.user._id, {
        content: content.trim(),
        messageType,
        replyTo,
        mentions
      });

      res.status(201).json({
        success: true,
        data: message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Edit message
router.put('/messages/:messageId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('messageId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message content cannot be empty'
        });
      }

      const message = await ChatService.editMessage(messageId, req.user._id, content.trim());

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Delete message
router.delete('/messages/:messageId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('messageId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { permanent = false } = req.query;

      const result = await ChatService.deleteMessage(messageId, req.user._id, permanent === 'true');

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

// Add reaction to message
router.post('/messages/:messageId/reactions',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('messageId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({
          success: false,
          message: 'Emoji is required'
        });
      }

      const message = await ChatService.addReaction(messageId, req.user._id, emoji);

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Remove reaction from message
router.delete('/messages/:messageId/reactions',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('messageId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.query;

      if (!emoji) {
        return res.status(400).json({
          success: false,
          message: 'Emoji is required'
        });
      }

      const message = await ChatService.removeReaction(messageId, req.user._id, emoji);

      res.json({
        success: true,
        data: message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Mark messages as read
router.post('/rooms/:roomId/read',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      
      const participant = await ChatService.markAsRead(roomId, req.user._id);

      res.json({
        success: true,
        data: participant
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get unread message counts
router.get('/unread-counts',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const unreadCounts = await ChatService.getUnreadCounts(req.user._id);

      res.json({
        success: true,
        data: unreadCounts
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update chat room settings (admin only)
router.put('/rooms/:roomId/settings',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId } = req.params;
      const { settings } = req.body;

      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat room not found'
        });
      }

      // Check if user is admin
      const participant = chatRoom.participants.find(p => p.user.toString() === req.user._id.toString());
      if (!participant || !['admin', 'moderator'].includes(participant.role)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin or moderator role required.'
        });
      }

      chatRoom.settings = { ...chatRoom.settings, ...settings };
      await chatRoom.save();

      res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update participant role (admin only)
router.put('/rooms/:roomId/participants/:userId/role',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('roomId'),
  commonValidations.mongoId('userId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { roomId, userId } = req.params;
      const { role } = req.body;

      if (!['admin', 'moderator', 'member'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be admin, moderator, or member.'
        });
      }

      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat room not found'
        });
      }

      // Check if user is admin
      const adminParticipant = chatRoom.participants.find(p => p.user.toString() === req.user._id.toString());
      if (!adminParticipant || adminParticipant.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin role required.'
        });
      }

      await chatRoom.updateParticipantRole(userId, role);

      res.json({
        success: true,
        data: await ChatService.getChatRoomById(roomId)
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