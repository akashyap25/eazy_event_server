const express = require('express');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');
const { handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const socialMediaService = require('../services/socialMediaService');
const Event = require('../models/event');

const router = express.Router();

// Get all supported platforms
router.get('/platforms',
  async (req, res) => {
    try {
      const platforms = socialMediaService.getAllPlatformConfigs();
      
      res.json({
        success: true,
        data: platforms
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get platforms that support login
router.get('/platforms/login',
  async (req, res) => {
    try {
      const platforms = socialMediaService.getLoginSupportedPlatforms();
      
      res.json({
        success: true,
        data: platforms
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate share URLs for an event
router.get('/events/:eventId/share',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { platform } = req.query;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const shareData = socialMediaService.generateEventShareData(event);

      if (platform) {
        // Generate URL for specific platform
        const shareUrl = socialMediaService.generateShareUrl(platform, shareData);
        res.json({
          success: true,
          data: {
            platform,
            shareUrl,
            shareData
          }
        });
      } else {
        // Generate URLs for all platforms
        const shareUrls = socialMediaService.generateAllShareUrls(shareData);
        res.json({
          success: true,
          data: {
            shareUrls,
            shareData
          }
        });
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate social media preview for an event
router.get('/events/:eventId/preview',
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

      const preview = socialMediaService.generateSocialPreview(event);

      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate embed code for an event
router.get('/events/:eventId/embed',
  commonValidations.mongoId('eventId'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const {
        width = 400,
        height = 300,
        theme = 'light',
        showImage = true,
        showDescription = true,
        showDate = true,
        showLocation = true
      } = req.query;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Event not found'
        });
      }

      const embedCode = socialMediaService.generateEmbedCode(event, {
        width: parseInt(width),
        height: parseInt(height),
        theme,
        showImage: showImage === 'true',
        showDescription: showDescription === 'true',
        showDate: showDate === 'true',
        showLocation: showLocation === 'true'
      });

      res.json({
        success: true,
        data: {
          embedCode,
          options: {
            width: parseInt(width),
            height: parseInt(height),
            theme,
            showImage: showImage === 'true',
            showDescription: showDescription === 'true',
            showDate: showDate === 'true',
            showLocation: showLocation === 'true'
          }
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate QR code data for an event
router.get('/events/:eventId/qr',
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

      const qrData = socialMediaService.generateQRCodeData(event);

      res.json({
        success: true,
        data: qrData
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate hashtags for an event
router.get('/events/:eventId/hashtags',
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

      const hashtags = socialMediaService.generateEventHashtags(event);

      res.json({
        success: true,
        data: {
          hashtags,
          suggested: hashtags.slice(0, 5), // Top 5 hashtags
          all: hashtags
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate social media analytics
router.get('/events/:eventId/analytics',
  authenticateToken,
  requireAuth,
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

      // Check if user is event organizer
      if (event.organizer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only event organizer can view analytics.'
        });
      }

      // Mock analytics data - in real implementation, this would come from analytics service
      const mockAnalytics = {
        totalShares: 0,
        platformShares: {},
        clickThroughRate: 0,
        engagementRate: 0
      };

      const socialAnalytics = socialMediaService.generateSocialAnalytics(event, mockAnalytics);

      res.json({
        success: true,
        data: socialAnalytics
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Track social media share
router.post('/track-share',
  async (req, res) => {
    try {
      const { eventId, platform, userId } = req.body;

      if (!eventId || !platform) {
        return res.status(400).json({
          success: false,
          message: 'Event ID and platform are required'
        });
      }

      // In real implementation, this would track the share in analytics
      // For now, just return success
      res.json({
        success: true,
        data: {
          eventId,
          platform,
          userId: userId || null,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate custom share URL
router.post('/generate-share-url',
  async (req, res) => {
    try {
      const { platform, data } = req.body;

      if (!platform || !data) {
        return res.status(400).json({
          success: false,
          message: 'Platform and data are required'
        });
      }

      const shareUrl = socialMediaService.generateShareUrl(platform, data);

      res.json({
        success: true,
        data: {
          platform,
          shareUrl,
          originalData: data
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Get platform configuration
router.get('/platforms/:platform',
  async (req, res) => {
    try {
      const { platform } = req.params;

      const config = socialMediaService.getPlatformConfig(platform);

      if (!config) {
        return res.status(404).json({
          success: false,
          message: 'Platform not found'
        });
      }

      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate sharing recommendations
router.get('/events/:eventId/recommendations',
  authenticateToken,
  requireAuth,
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

      // Mock analytics data
      const mockAnalytics = {
        totalShares: 0,
        platformShares: {},
        clickThroughRate: 0,
        engagementRate: 0
      };

      const recommendations = socialMediaService.generateSharingRecommendations(event, mockAnalytics);

      res.json({
        success: true,
        data: {
          event: {
            id: event._id,
            title: event.title
          },
          recommendations
        }
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