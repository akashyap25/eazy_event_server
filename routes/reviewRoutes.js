const express = require('express');
const router = express.Router();
const {
  createReview,
  getEventReviews,
  getReviewById,
  updateReview,
  deleteReview,
  markHelpful,
  removeHelpful,
  reportReview,
  addOrganizerResponse,
  getMyReviews
} = require('../controllers/reviewController');
const { authenticateToken, optionalAuth } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Event review and feedback management
 */

// Public routes
/**
 * @swagger
 * /api/reviews/event/:eventId:
 *   get:
 *     summary: Get reviews for an event
 *     tags: [Reviews]
 */
router.get('/event/:eventId', optionalAuth, getEventReviews);

/**
 * @swagger
 * /api/reviews/:reviewId:
 *   get:
 *     summary: Get review by ID
 *     tags: [Reviews]
 */
router.get('/:reviewId', optionalAuth, getReviewById);

// Protected routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/reviews/my:
 *   get:
 *     summary: Get current user's reviews
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my/all', getMyReviews);

/**
 * @swagger
 * /api/reviews/event/:eventId:
 *   post:
 *     summary: Create a review for an event
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/event/:eventId', createReview);

/**
 * @swagger
 * /api/reviews/:reviewId:
 *   put:
 *     summary: Update your review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:reviewId', updateReview);

/**
 * @swagger
 * /api/reviews/:reviewId:
 *   delete:
 *     summary: Delete your review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:reviewId', deleteReview);

/**
 * @swagger
 * /api/reviews/:reviewId/helpful:
 *   post:
 *     summary: Mark review as helpful
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:reviewId/helpful', markHelpful);

/**
 * @swagger
 * /api/reviews/:reviewId/helpful:
 *   delete:
 *     summary: Remove helpful vote
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:reviewId/helpful', removeHelpful);

/**
 * @swagger
 * /api/reviews/:reviewId/report:
 *   post:
 *     summary: Report a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:reviewId/report', reportReview);

/**
 * @swagger
 * /api/reviews/:reviewId/response:
 *   post:
 *     summary: Add organizer response to review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:reviewId/response', addOrganizerResponse);

module.exports = router;
