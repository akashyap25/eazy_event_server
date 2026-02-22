const express = require('express');
const router = express.Router();
const {
  generateDescription,
  generateTags,
  generateTaskBreakdown,
  suggestTitles,
  improveText,
  generateSocialPost,
  answerQuestion,
  analyzeReviews,
  getRecommendations
} = require('../controllers/aiController');
const { authenticateToken, optionalAuth } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered features for event management
 */

/**
 * @swagger
 * /api/ai/generate-description:
 *   post:
 *     summary: Generate event description using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *               location:
 *                 type: string
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *               targetAudience:
 *                 type: string
 *     responses:
 *       200:
 *         description: Description generated successfully
 */
router.post('/generate-description', authenticateToken, generateDescription);

/**
 * @swagger
 * /api/ai/generate-tags:
 *   post:
 *     summary: Generate event tags using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate-tags', authenticateToken, generateTags);

/**
 * @swagger
 * /api/ai/generate-tasks:
 *   post:
 *     summary: Generate task breakdown for an event
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate-tasks', authenticateToken, generateTaskBreakdown);

/**
 * @swagger
 * /api/ai/suggest-titles:
 *   post:
 *     summary: Suggest event titles based on keywords
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/suggest-titles', authenticateToken, suggestTitles);

/**
 * @swagger
 * /api/ai/improve-text:
 *   post:
 *     summary: Improve text using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/improve-text', authenticateToken, improveText);

/**
 * @swagger
 * /api/ai/social-post:
 *   post:
 *     summary: Generate social media post for an event
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.post('/social-post', authenticateToken, generateSocialPost);

/**
 * @swagger
 * /api/ai/answer:
 *   post:
 *     summary: Answer questions about an event using AI
 *     tags: [AI]
 */
router.post('/answer', optionalAuth, answerQuestion);

/**
 * @swagger
 * /api/ai/sentiment/{eventId}:
 *   get:
 *     summary: Analyze sentiment of event reviews
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 */
router.get('/sentiment/:eventId', authenticateToken, analyzeReviews);

/**
 * @swagger
 * /api/ai/recommendations:
 *   post:
 *     summary: Get personalized event recommendations
 *     tags: [AI]
 */
router.post('/recommendations', optionalAuth, getRecommendations);

module.exports = router;
