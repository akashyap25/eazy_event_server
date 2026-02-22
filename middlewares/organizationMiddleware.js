const Organization = require('../models/organization');
const OrganizationMember = require('../models/organizationMember');

/**
 * Set organization context from header or query parameter
 * Injects req.organization and req.orgMember if found
 */
const setOrgContext = async (req, res, next) => {
  try {
    const orgId = req.headers['x-organization-id'] || req.query.organizationId;
    
    if (!orgId) {
      req.organization = null;
      req.orgMember = null;
      return next();
    }

    const organization = await Organization.findOne({ 
      _id: orgId, 
      isActive: true, 
      isDeleted: false 
    });

    if (!organization) {
      req.organization = null;
      req.orgMember = null;
      return next();
    }

    req.organization = organization;

    // If user is authenticated, get their membership
    if (req.user && req.user._id) {
      const membership = await OrganizationMember.findByUserAndOrg(
        req.user._id, 
        organization._id
      );
      req.orgMember = membership;
    }

    next();
  } catch (error) {
    console.error('Error setting org context:', error);
    next();
  }
};

/**
 * Require user to belong to an organization
 * Must be used after authenticateToken middleware
 */
const requireOrganization = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const orgId = req.headers['x-organization-id'] || req.query.organizationId || req.body.organizationId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required'
      });
    }

    const organization = await Organization.findOne({ 
      _id: orgId, 
      isActive: true, 
      isDeleted: false 
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const membership = await OrganizationMember.findByUserAndOrg(
      req.user._id, 
      organization._id
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this organization'
      });
    }

    req.organization = organization;
    req.orgMember = membership;

    next();
  } catch (error) {
    console.error('Error in requireOrganization:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying organization membership'
    });
  }
};

/**
 * Require specific organization role(s)
 * @param {string|string[]} roles - Required role(s)
 */
const requireOrgRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    try {
      if (!req.orgMember) {
        return res.status(403).json({
          success: false,
          message: 'Organization membership required'
        });
      }

      // Owner has all privileges
      if (req.orgMember.role === 'owner') {
        return next();
      }

      if (!allowedRoles.includes(req.orgMember.role)) {
        return res.status(403).json({
          success: false,
          message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireOrgRole:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking organization role'
      });
    }
  };
};

/**
 * Require specific organization permission(s)
 * @param {string|string[]} permissions - Required permission(s)
 */
const requireOrgPermission = (permissions) => {
  const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

  return async (req, res, next) => {
    try {
      if (!req.orgMember) {
        return res.status(403).json({
          success: false,
          message: 'Organization membership required'
        });
      }

      // Owner has all permissions
      if (req.orgMember.role === 'owner') {
        return next();
      }

      const hasAllPermissions = requiredPermissions.every(
        perm => req.orgMember.hasPermission(perm)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: `Missing required permissions: ${requiredPermissions.join(', ')}`
        });
      }

      next();
    } catch (error) {
      console.error('Error in requireOrgPermission:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking organization permissions'
      });
    }
  };
};

/**
 * Filter query results by organization
 * Adds organizationId filter to req.orgFilter
 */
const filterByOrganization = (req, res, next) => {
  try {
    if (req.organization) {
      req.orgFilter = { organizationId: req.organization._id };
    } else {
      req.orgFilter = {};
    }
    next();
  } catch (error) {
    console.error('Error in filterByOrganization:', error);
    next();
  }
};

/**
 * Check if user is organization owner
 */
const requireOrgOwner = async (req, res, next) => {
  try {
    if (!req.orgMember || req.orgMember.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the organization owner can perform this action'
      });
    }
    next();
  } catch (error) {
    console.error('Error in requireOrgOwner:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking organization ownership'
    });
  }
};

/**
 * Check if organization has active subscription
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.organization) {
      return res.status(400).json({
        success: false,
        message: 'Organization context required'
      });
    }

    const validStatuses = ['active', 'trialing'];
    if (!validStatuses.includes(req.organization.subscription?.status)) {
      return res.status(403).json({
        success: false,
        message: 'This feature requires an active subscription'
      });
    }

    next();
  } catch (error) {
    console.error('Error in requireActiveSubscription:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
};

/**
 * Check organization plan limits
 * @param {string} limitType - Type of limit to check (maxEvents, maxMembers, maxStorage)
 */
const checkOrgLimit = (limitType) => {
  return async (req, res, next) => {
    try {
      if (!req.organization) {
        return res.status(400).json({
          success: false,
          message: 'Organization context required'
        });
      }

      const limits = req.organization.settings?.limits || {};
      const usage = req.organization.usage || {};

      const limitChecks = {
        maxEvents: () => usage.eventsCreated < (limits.maxEvents || 100),
        maxMembers: () => true, // Checked separately when adding members
        maxStorage: () => usage.storageUsed < (limits.maxStorage || 5000)
      };

      if (limitChecks[limitType] && !limitChecks[limitType]()) {
        return res.status(403).json({
          success: false,
          message: `Organization has reached its ${limitType} limit. Please upgrade your plan.`
        });
      }

      next();
    } catch (error) {
      console.error('Error in checkOrgLimit:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking organization limits'
      });
    }
  };
};

module.exports = {
  setOrgContext,
  requireOrganization,
  requireOrgRole,
  requireOrgPermission,
  filterByOrganization,
  requireOrgOwner,
  requireActiveSubscription,
  checkOrgLimit
};
