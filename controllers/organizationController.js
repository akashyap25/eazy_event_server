const Organization = require('../models/organization');
const OrganizationMember = require('../models/organizationMember');
const OrganizationInvite = require('../models/organizationInvite');
const { User } = require('../models/user');

// Create a new organization
const createOrganization = async (req, res) => {
  try {
    const { name, description, logo, website, settings } = req.body;
    const userId = req.user._id;

    // Check if user already owns an organization (free plan limit)
    const existingOrg = await Organization.findOne({ owner: userId, isDeleted: false });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: 'You already own an organization. Upgrade to create more.'
      });
    }

    // Create organization
    const organization = new Organization({
      name,
      description,
      logo,
      website,
      owner: userId,
      settings: settings || {}
    });

    await organization.save();

    // Add creator as owner member
    const membership = new OrganizationMember({
      user: userId,
      organization: organization._id,
      role: 'owner',
      status: 'active',
      joinedAt: new Date()
    });

    await membership.save();

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: {
        organization,
        membership
      }
    });
  } catch (error) {
    console.error('Error creating organization:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An organization with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating organization',
      error: error.message
    });
  }
};

// Get organization by ID or slug
const getOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    
    let organization;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      organization = await Organization.findOne({ _id: id, isDeleted: false });
    } else {
      organization = await Organization.findBySlug(id);
    }

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Get member count
    const memberCount = await OrganizationMember.countDocuments({
      organization: organization._id,
      status: 'active'
    });

    res.json({
      success: true,
      data: {
        ...organization.toObject(),
        memberCount
      }
    });
  } catch (error) {
    console.error('Error getting organization:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting organization',
      error: error.message
    });
  }
};

// Update organization
const updateOrganization = async (req, res) => {
  try {
    const { name, description, logo, website, settings } = req.body;
    const organization = req.organization;

    if (name) organization.name = name;
    if (description !== undefined) organization.description = description;
    if (logo !== undefined) organization.logo = logo;
    if (website !== undefined) organization.website = website;
    if (settings) {
      organization.settings = { ...organization.settings, ...settings };
    }

    await organization.save();

    res.json({
      success: true,
      message: 'Organization updated successfully',
      data: organization
    });
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating organization',
      error: error.message
    });
  }
};

// Delete organization (soft delete)
const deleteOrganization = async (req, res) => {
  try {
    const organization = req.organization;

    organization.isDeleted = true;
    organization.deletedAt = new Date();
    organization.isActive = false;

    await organization.save();

    // Deactivate all memberships
    await OrganizationMember.updateMany(
      { organization: organization._id },
      { status: 'removed' }
    );

    res.json({
      success: true,
      message: 'Organization deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting organization',
      error: error.message
    });
  }
};

// Get user's organizations
const getUserOrganizations = async (req, res) => {
  try {
    const userId = req.user._id;

    const memberships = await OrganizationMember.getUserOrganizations(userId);

    res.json({
      success: true,
      data: memberships
    });
  } catch (error) {
    console.error('Error getting user organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting organizations',
      error: error.message
    });
  }
};

// Get organization members
const getMembers = async (req, res) => {
  try {
    const organization = req.organization;
    const { role, status } = req.query;

    const query = { organization: organization._id };
    if (role) query.role = role;
    if (status) query.status = status;
    else query.status = 'active';

    const members = await OrganizationMember.find(query)
      .populate('user', 'firstName lastName email avatar username')
      .populate('invitedBy', 'firstName lastName')
      .sort({ role: 1, joinedAt: -1 });

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Error getting members:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting members',
      error: error.message
    });
  }
};

// Invite member to organization
const inviteMember = async (req, res) => {
  try {
    const organization = req.organization;
    const { email, role, permissions, message } = req.body;
    const inviterId = req.user._id;

    // Check if user is already a member
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const existingMember = await OrganizationMember.findOne({
        user: existingUser._id,
        organization: organization._id,
        status: { $in: ['active', 'invited'] }
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'This user is already a member of the organization'
        });
      }
    }

    // Check for existing pending invite
    const existingInvite = await OrganizationInvite.getInviteByEmail(email, organization._id);
    if (existingInvite) {
      return res.status(400).json({
        success: false,
        message: 'An invite has already been sent to this email'
      });
    }

    // Check organization member limit
    const memberCount = await OrganizationMember.countDocuments({
      organization: organization._id,
      status: 'active'
    });
    
    if (memberCount >= organization.settings.limits.maxMembers) {
      return res.status(403).json({
        success: false,
        message: 'Organization has reached its member limit'
      });
    }

    // Create invite
    const invite = new OrganizationInvite({
      email: email.toLowerCase(),
      organization: organization._id,
      role: role || 'member',
      permissions,
      invitedBy: inviterId,
      message
    });

    await invite.save();

    // TODO: Send invitation email

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      data: invite
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending invitation',
      error: error.message
    });
  }
};

// Accept organization invite
const acceptInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user._id;

    const invite = await OrganizationInvite.findByToken(token);
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    // Check if user email matches invite email
    const user = await User.findById(userId);
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'This invitation was sent to a different email address'
      });
    }

    // Create membership
    const membership = new OrganizationMember({
      user: userId,
      organization: invite.organization._id,
      role: invite.role,
      permissions: invite.permissions,
      status: 'active',
      invitedBy: invite.invitedBy,
      invitedAt: invite.createdAt,
      joinedAt: new Date()
    });

    await membership.save();

    // Mark invite as accepted
    await invite.accept(userId);

    res.json({
      success: true,
      message: 'You have joined the organization',
      data: {
        membership,
        organization: invite.organization
      }
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting invitation',
      error: error.message
    });
  }
};

// Decline organization invite
const declineInvite = async (req, res) => {
  try {
    const { token } = req.params;

    const invite = await OrganizationInvite.findByToken(token);
    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    await invite.decline();

    res.json({
      success: true,
      message: 'Invitation declined'
    });
  } catch (error) {
    console.error('Error declining invite:', error);
    res.status(500).json({
      success: false,
      message: 'Error declining invitation',
      error: error.message
    });
  }
};

// Get pending invites
const getPendingInvites = async (req, res) => {
  try {
    const organization = req.organization;

    const invites = await OrganizationInvite.getPendingInvites(organization._id);

    res.json({
      success: true,
      data: invites
    });
  } catch (error) {
    console.error('Error getting pending invites:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting invites',
      error: error.message
    });
  }
};

// Cancel invite
const cancelInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;
    const organization = req.organization;

    const invite = await OrganizationInvite.findOne({
      _id: inviteId,
      organization: organization._id,
      status: 'pending'
    });

    if (!invite) {
      return res.status(404).json({
        success: false,
        message: 'Invite not found'
      });
    }

    invite.status = 'cancelled';
    await invite.save();

    res.json({
      success: true,
      message: 'Invitation cancelled'
    });
  } catch (error) {
    console.error('Error cancelling invite:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling invitation',
      error: error.message
    });
  }
};

// Update member role
const updateMemberRole = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { role, permissions } = req.body;
    const organization = req.organization;

    const member = await OrganizationMember.findOne({
      _id: memberId,
      organization: organization._id,
      status: 'active'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Cannot change owner's role
    if (member.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot change owner role'
      });
    }

    // Check if current user can manage this role
    if (!req.orgMember.canManageRole(role)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot assign this role'
      });
    }

    member.role = role;
    if (permissions) {
      member.permissions = permissions;
    }

    await member.save();

    res.json({
      success: true,
      message: 'Member role updated',
      data: member
    });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating member role',
      error: error.message
    });
  }
};

// Remove member from organization
const removeMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const organization = req.organization;

    const member = await OrganizationMember.findOne({
      _id: memberId,
      organization: organization._id,
      status: 'active'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    // Cannot remove owner
    if (member.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove organization owner'
      });
    }

    member.status = 'removed';
    await member.save();

    res.json({
      success: true,
      message: 'Member removed from organization'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing member',
      error: error.message
    });
  }
};

// Leave organization
const leaveOrganization = async (req, res) => {
  try {
    const organization = req.organization;
    const userId = req.user._id;

    const member = await OrganizationMember.findOne({
      user: userId,
      organization: organization._id,
      status: 'active'
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'You are not a member of this organization'
      });
    }

    // Owner cannot leave without transferring ownership
    if (member.role === 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Owner must transfer ownership before leaving'
      });
    }

    member.status = 'removed';
    await member.save();

    res.json({
      success: true,
      message: 'You have left the organization'
    });
  } catch (error) {
    console.error('Error leaving organization:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving organization',
      error: error.message
    });
  }
};

// Transfer ownership
const transferOwnership = async (req, res) => {
  try {
    const { newOwnerId } = req.body;
    const organization = req.organization;

    // Get new owner's membership
    const newOwnerMember = await OrganizationMember.findOne({
      user: newOwnerId,
      organization: organization._id,
      status: 'active'
    });

    if (!newOwnerMember) {
      return res.status(404).json({
        success: false,
        message: 'New owner must be a member of the organization'
      });
    }

    // Get current owner's membership
    const currentOwnerMember = await OrganizationMember.findOne({
      user: req.user._id,
      organization: organization._id,
      role: 'owner'
    });

    // Update roles
    currentOwnerMember.role = 'admin';
    newOwnerMember.role = 'owner';

    // Update organization owner
    organization.owner = newOwnerId;

    await Promise.all([
      currentOwnerMember.save(),
      newOwnerMember.save(),
      organization.save()
    ]);

    res.json({
      success: true,
      message: 'Ownership transferred successfully'
    });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    res.status(500).json({
      success: false,
      message: 'Error transferring ownership',
      error: error.message
    });
  }
};

module.exports = {
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
};
