const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const { body, param } = require('express-validator');
const EventTemplateService = require('../services/eventTemplateService');

const router = express.Router();

// Create event template
router.post('/',
  authenticateToken,
  requireAuth,
  [
    body('name')
      .notEmpty()
      .withMessage('Template name is required')
      .isLength({ min: 3, max: 100 })
      .withMessage('Template name must be between 3 and 100 characters'),
    body('description')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    body('category')
      .isMongoId()
      .withMessage('Valid category ID is required'),
    body('templateData')
      .isObject()
      .withMessage('Template data is required'),
    body('templateData.title')
      .notEmpty()
      .withMessage('Event title is required'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const templateData = req.body;
      const createdBy = req.auth.userId;
      
      const result = await EventTemplateService.createTemplate(templateData, createdBy);
      
      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: result.template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get all templates
router.get('/',
  async (req, res) => {
    try {
      const { 
        category, 
        isPublic = true, 
        search, 
        page = 1, 
        limit = 10,
        sortBy = 'usageCount',
        sortOrder = 'desc'
      } = req.query;
      
      const result = await EventTemplateService.getTemplates({
        category,
        isPublic: isPublic === 'true',
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      });
      
      res.json({
        success: true,
        data: result.templates,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get template by ID
router.get('/:templateId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('templateId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      
      const result = await EventTemplateService.getTemplateById(templateId);
      
      res.json({
        success: true,
        data: result.template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Create event from template
router.post('/:templateId/create-event',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('templateId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const customizations = req.body;
      const userId = req.auth.userId;
      
      const result = await EventTemplateService.createEventFromTemplate(
        templateId, 
        userId, 
        customizations
      );
      
      res.status(201).json({
        success: true,
        message: 'Event created from template successfully',
        data: result.event
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update template
router.put('/:templateId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('templateId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const updateData = req.body;
      const userId = req.auth.userId;
      
      const result = await EventTemplateService.updateTemplate(
        templateId, 
        updateData, 
        userId
      );
      
      res.json({
        success: true,
        message: 'Template updated successfully',
        data: result.template
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Delete template
router.delete('/:templateId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('templateId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const userId = req.auth.userId;
      
      const result = await EventTemplateService.deleteTemplate(templateId, userId);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Rate template
router.post('/:templateId/rate',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('templateId'),
  [
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { templateId } = req.params;
      const { rating } = req.body;
      const userId = req.auth.userId;
      
      const result = await EventTemplateService.rateTemplate(templateId, rating, userId);
      
      res.json({
        success: true,
        message: 'Template rated successfully',
        data: { rating: result.rating }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get popular templates
router.get('/popular',
  async (req, res) => {
    try {
      const { limit = 10 } = req.query;
      
      const result = await EventTemplateService.getPopularTemplates(parseInt(limit));
      
      res.json({
        success: true,
        data: result.templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get templates by category
router.get('/category/:categoryId',
  authenticateToken,
  requireAuth,
  commonValidations.mongoId('categoryId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { limit = 10 } = req.query;
      
      const result = await EventTemplateService.getTemplatesByCategory(
        categoryId, 
        parseInt(limit)
      );
      
      res.json({
        success: true,
        data: result.templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Create default templates (admin only)
router.post('/create-defaults',
  authenticateToken,
  requireAuth,
  async (req, res) => {
    try {
      // In a real app, you'd check if user is admin
      // For now, we'll allow any authenticated user
      
      const result = await EventTemplateService.createDefaultTemplates();
      
      res.status(201).json({
        success: true,
        message: 'Default templates created successfully',
        data: {
          templates: result.templates,
          count: result.count
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

module.exports = router;