const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const { body, param } = require('express-validator');
const EventCollaborationService = require('../services/eventCollaborationService');

const router = express.Router();

// Add co-organizer to event
router.post('/:eventId/co-organizers',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  [
    body('userId')
      .isMongoId()
      .withMessage('Valid user ID is required'),
    body('role')
      .optional()
      .isIn(['co-organizer', 'assistant', 'moderator'])
      .withMessage('Invalid role'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { userId, role = 'co-organizer', permissions = [] } = req.body;
      const addedBy = req.auth.userId;
      
      const result = await EventCollaborationService.addCoOrganizer(
        eventId, 
        userId, 
        role, 
        permissions, 
        addedBy
      );
      
      res.status(201).json({
        success: true,
        message: 'Co-organizer added successfully',
        data: result.coOrganizer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Remove co-organizer from event
router.delete('/:eventId/co-organizers/:userId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  commonValidations.mongoId('userId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId, userId } = req.params;
      const removedBy = req.auth.userId;
      
      const result = await EventCollaborationService.removeCoOrganizer(
        eventId, 
        userId, 
        removedBy
      );
      
      res.json({
        success: true,
        message: 'Co-organizer removed successfully',
        data: result.removedCoOrganizer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update co-organizer permissions
router.put('/:eventId/co-organizers/:userId/permissions',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  commonValidations.mongoId('userId'),
  [
    body('permissions')
      .isArray()
      .withMessage('Permissions must be an array'),
    body('permissions.*')
      .isIn(['edit', 'delete', 'manage_attendees', 'send_emails', 'view_analytics'])
      .withMessage('Invalid permission')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId, userId } = req.params;
      const { permissions } = req.body;
      const updatedBy = req.auth.userId;
      
      const result = await EventCollaborationService.updateCoOrganizerPermissions(
        eventId, 
        userId, 
        permissions, 
        updatedBy
      );
      
      res.json({
        success: true,
        message: 'Permissions updated successfully',
        data: result.coOrganizer
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get event collaborators
router.get('/:eventId/collaborators',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      
      const result = await EventCollaborationService.getEventCollaborators(eventId);
      
      res.json({
        success: true,
        data: result.collaborators
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Check user permissions for event
router.get('/:eventId/permissions/:userId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  commonValidations.mongoId('userId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId, userId } = req.params;
      const { action } = req.query;
      
      if (!action) {
        return res.status(400).json({
          success: false,
          message: 'Action parameter is required'
        });
      }
      
      const hasPermission = await EventCollaborationService.hasPermission(
        eventId, 
        userId, 
        action
      );
      
      res.json({
        success: true,
        data: {
          hasPermission,
          action,
          userId,
          eventId
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

// Transfer event ownership
router.post('/:eventId/transfer-ownership',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('eventId'),
  [
    body('newOwnerId')
      .isMongoId()
      .withMessage('Valid new owner ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { newOwnerId } = req.body;
      const currentOwnerId = req.auth.userId;
      
      const result = await EventCollaborationService.transferOwnership(
        eventId, 
        newOwnerId, 
        currentOwnerId
      );
      
      res.json({
        success: true,
        message: 'Ownership transferred successfully',
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

// Get available roles
router.get('/roles',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const roles = EventCollaborationService.getAvailableRoles();
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get available permissions
router.get('/permissions',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      const permissions = EventCollaborationService.getAvailablePermissions();
      
      res.json({
        success: true,
        data: permissions
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