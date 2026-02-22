const mongoose = require('mongoose');

const organizationMemberSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['owner', 'admin', 'manager', 'member', 'viewer'], 
    default: 'member' 
  },
  permissions: [{
    type: String,
    enum: [
      'create_events',
      'edit_events',
      'delete_events',
      'manage_attendees',
      'view_analytics',
      'manage_members',
      'manage_settings',
      'manage_billing',
      'send_communications',
      'export_data'
    ]
  }],
  status: { 
    type: String, 
    enum: ['active', 'invited', 'suspended', 'removed'], 
    default: 'active' 
  },
  invitedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  invitedAt: { 
    type: Date 
  },
  joinedAt: { 
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  title: {
    type: String,
    maxlength: 100
  },
  department: {
    type: String,
    maxlength: 100
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true }
  }
}, { timestamps: true });

// Compound unique index - user can only be in an org once
organizationMemberSchema.index({ user: 1, organization: 1 }, { unique: true });
organizationMemberSchema.index({ organization: 1, role: 1 });
organizationMemberSchema.index({ organization: 1, status: 1 });
organizationMemberSchema.index({ user: 1, status: 1 });

// Default permissions based on role
const rolePermissions = {
  owner: [
    'create_events', 'edit_events', 'delete_events', 'manage_attendees',
    'view_analytics', 'manage_members', 'manage_settings', 'manage_billing',
    'send_communications', 'export_data'
  ],
  admin: [
    'create_events', 'edit_events', 'delete_events', 'manage_attendees',
    'view_analytics', 'manage_members', 'manage_settings', 'send_communications',
    'export_data'
  ],
  manager: [
    'create_events', 'edit_events', 'manage_attendees', 'view_analytics',
    'send_communications'
  ],
  member: [
    'create_events', 'edit_events', 'view_analytics'
  ],
  viewer: [
    'view_analytics'
  ]
};

// Pre-save hook to set default permissions based on role
organizationMemberSchema.pre('save', function(next) {
  if (this.isNew && (!this.permissions || this.permissions.length === 0)) {
    this.permissions = rolePermissions[this.role] || [];
  }
  next();
});

// Methods
organizationMemberSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission) || this.role === 'owner';
};

organizationMemberSchema.methods.canManageRole = function(targetRole) {
  const roleHierarchy = ['viewer', 'member', 'manager', 'admin', 'owner'];
  const myLevel = roleHierarchy.indexOf(this.role);
  const targetLevel = roleHierarchy.indexOf(targetRole);
  return myLevel > targetLevel;
};

// Statics
organizationMemberSchema.statics.findByUserAndOrg = function(userId, orgId) {
  return this.findOne({ 
    user: userId, 
    organization: orgId, 
    status: 'active' 
  });
};

organizationMemberSchema.statics.getOrgMembers = function(orgId, options = {}) {
  const query = { organization: orgId, status: 'active' };
  if (options.role) query.role = options.role;
  
  return this.find(query)
    .populate('user', 'firstName lastName email avatar')
    .sort({ role: 1, joinedAt: -1 });
};

organizationMemberSchema.statics.getUserOrganizations = function(userId) {
  return this.find({ user: userId, status: 'active' })
    .populate('organization', 'name slug logo plan isActive')
    .sort({ joinedAt: -1 });
};

const OrganizationMember = mongoose.model('OrganizationMember', organizationMemberSchema);

module.exports = OrganizationMember;
