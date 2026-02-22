const express = require('express');
const router = express.Router();
const {
  createTicket,
  getTickets,
  getTicketById,
  addMessage,
  closeTicket,
  rateTicket,
  getFAQs,
  getFAQById,
  voteFAQ,
  getPopularFAQs,
  getAdminTickets,
  updateTicketStatus,
  assignTicket,
  addStaffReply,
  createFAQ,
  updateFAQ,
  deleteFAQ
} = require('../controllers/supportController');
const { authenticateToken, optionalAuth } = require('../middlewares/authMiddleware');
const { setOrgContext, requireOrgRole } = require('../middlewares/organizationMiddleware');

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Support ticket and FAQ management
 */

// ==================
// Public FAQ Routes
// ==================

/**
 * @swagger
 * /api/support/faqs:
 *   get:
 *     summary: Get all FAQs
 *     tags: [Support]
 */
router.get('/faqs', optionalAuth, setOrgContext, getFAQs);

/**
 * @swagger
 * /api/support/faqs/popular:
 *   get:
 *     summary: Get popular FAQs
 *     tags: [Support]
 */
router.get('/faqs/popular', optionalAuth, setOrgContext, getPopularFAQs);

/**
 * @swagger
 * /api/support/faqs/:faqId:
 *   get:
 *     summary: Get FAQ by ID
 *     tags: [Support]
 */
router.get('/faqs/:faqId', optionalAuth, setOrgContext, getFAQById);

// ==================
// Authenticated Routes
// ==================
router.use(authenticateToken);
router.use(setOrgContext);

// ==================
// User Ticket Routes
// ==================

/**
 * @swagger
 * /api/support/tickets:
 *   post:
 *     summary: Create a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets', createTicket);

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Get user's tickets
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tickets', getTickets);

/**
 * @swagger
 * /api/support/tickets/:ticketId:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tickets/:ticketId', getTicketById);

/**
 * @swagger
 * /api/support/tickets/:ticketId/messages:
 *   post:
 *     summary: Add message to ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets/:ticketId/messages', addMessage);

/**
 * @swagger
 * /api/support/tickets/:ticketId/close:
 *   put:
 *     summary: Close ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.put('/tickets/:ticketId/close', closeTicket);

/**
 * @swagger
 * /api/support/tickets/:ticketId/rate:
 *   post:
 *     summary: Rate resolved ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets/:ticketId/rate', rateTicket);

/**
 * @swagger
 * /api/support/faqs/:faqId/vote:
 *   post:
 *     summary: Vote on FAQ helpfulness
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/faqs/:faqId/vote', voteFAQ);

// ==================
// Admin Routes
// ==================

/**
 * @swagger
 * /api/support/admin/tickets:
 *   get:
 *     summary: Get all tickets (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/tickets', requireOrgRole(['owner', 'admin', 'manager']), getAdminTickets);

/**
 * @swagger
 * /api/support/admin/tickets/:ticketId/status:
 *   put:
 *     summary: Update ticket status (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/tickets/:ticketId/status', requireOrgRole(['owner', 'admin', 'manager']), updateTicketStatus);

/**
 * @swagger
 * /api/support/admin/tickets/:ticketId/assign:
 *   put:
 *     summary: Assign ticket (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/tickets/:ticketId/assign', requireOrgRole(['owner', 'admin', 'manager']), assignTicket);

/**
 * @swagger
 * /api/support/admin/tickets/:ticketId/reply:
 *   post:
 *     summary: Add staff reply (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/tickets/:ticketId/reply', requireOrgRole(['owner', 'admin', 'manager']), addStaffReply);

/**
 * @swagger
 * /api/support/admin/faqs:
 *   post:
 *     summary: Create FAQ (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.post('/admin/faqs', requireOrgRole(['owner', 'admin']), createFAQ);

/**
 * @swagger
 * /api/support/admin/faqs/:faqId:
 *   put:
 *     summary: Update FAQ (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.put('/admin/faqs/:faqId', requireOrgRole(['owner', 'admin']), updateFAQ);

/**
 * @swagger
 * /api/support/admin/faqs/:faqId:
 *   delete:
 *     summary: Delete FAQ (admin)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/admin/faqs/:faqId', requireOrgRole(['owner', 'admin']), deleteFAQ);

module.exports = router;
