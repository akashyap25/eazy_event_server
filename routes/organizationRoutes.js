const express = require('express');
const router = express.Router();
const {
  createOrganization,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  getUserOrganizations,
  getMembers,
  inviteMember,
  acceptInvite,
  declineInvite,
  getPendingInvites,
  cancelInvite,
  updateMemberRole,
  removeMember,
  leaveOrganization,
  transferOwnership
} = require('../controllers/organizationController');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { 
  requireOrganization, 
  requireOrgRole, 
  requireOrgOwner,
  requireOrgPermission
} = require('../middlewares/organizationMiddleware');

// Public routes
router.get('/:id', getOrganization);

// Authenticated routes
router.use(authenticateToken);

// User's organizations
router.get('/', getUserOrganizations);
router.post('/', createOrganization);

// Invite routes (don't require org context since user might not be member yet)
router.post('/invites/:token/accept', acceptInvite);
router.post('/invites/:token/decline', declineInvite);

// Organization-specific routes (require membership)
router.use('/:orgId', async (req, res, next) => {
  req.headers['x-organization-id'] = req.params.orgId;
  next();
}, requireOrganization);

// Organization management
router.put('/:orgId', requireOrgRole(['owner', 'admin']), updateOrganization);
router.delete('/:orgId', requireOrgOwner, deleteOrganization);

// Members management
router.get('/:orgId/members', getMembers);
router.post('/:orgId/members/invite', requireOrgPermission('manage_members'), inviteMember);
router.get('/:orgId/invites', requireOrgPermission('manage_members'), getPendingInvites);
router.delete('/:orgId/invites/:inviteId', requireOrgPermission('manage_members'), cancelInvite);
router.put('/:orgId/members/:memberId/role', requireOrgPermission('manage_members'), updateMemberRole);
router.delete('/:orgId/members/:memberId', requireOrgPermission('manage_members'), removeMember);
router.post('/:orgId/leave', leaveOrganization);
router.post('/:orgId/transfer-ownership', requireOrgOwner, transferOwnership);

module.exports = router;
