const express = require('express');
const router = express.Router();
const {
  generateTicketQR,
  scanCheckIn,
  manualCheckIn,
  getEventCheckIns,
  getCheckInStats,
  undoCheckIn,
  getMyTickets
} = require('../controllers/checkInController');
const { authenticateToken } = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Check-In
 *   description: Event check-in and ticket management
 */

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/check-in/my-tickets:
 *   get:
 *     summary: Get user's tickets with QR codes
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-tickets', getMyTickets);

/**
 * @swagger
 * /api/check-in/ticket/:orderId:
 *   get:
 *     summary: Generate ticket QR code for an order
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.get('/ticket/:orderId', generateTicketQR);

/**
 * @swagger
 * /api/check-in/scan:
 *   post:
 *     summary: Scan QR code to check in attendee
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.post('/scan', scanCheckIn);

/**
 * @swagger
 * /api/check-in/manual:
 *   post:
 *     summary: Manually check in attendee by email
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.post('/manual', manualCheckIn);

/**
 * @swagger
 * /api/check-in/event/:eventId:
 *   get:
 *     summary: Get all check-ins for an event
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.get('/event/:eventId', getEventCheckIns);

/**
 * @swagger
 * /api/check-in/event/:eventId/stats:
 *   get:
 *     summary: Get check-in statistics for an event
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.get('/event/:eventId/stats', getCheckInStats);

/**
 * @swagger
 * /api/check-in/:checkInId/undo:
 *   put:
 *     summary: Undo a check-in
 *     tags: [Check-In]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:checkInId/undo', undoCheckIn);

module.exports = router;
