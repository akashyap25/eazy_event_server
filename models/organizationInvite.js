const mongoose = require('mongoose');
const crypto = require('crypto');

const organizationInviteSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  organization: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization', 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['admin', 'manager', 'member', 'viewer'], 
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
      'send_communications',
      'export_data'
    ]
  }],
  token: { 
    type: String, 
    required: true,
    unique: true
  },
  expiresAt: { 
    type: Date, 
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  },
  status: { 
    type: String, 
    enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'], 
    default: 'pending' 
  },
  invitedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  message: {
    type: String,
    maxlength: 500
  },
  acceptedAt: { 
    type: Date 
  },
  acceptedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  resendCount: {
    type: Number,
    default: 0
  },
  lastResentAt: {
    type: Date
  }
}, { timestamps: true });

// Indexes
organizationInviteSchema.index({ token: 1 }, { unique: true });
organizationInviteSchema.index({ email: 1, organization: 1 });
organizationInviteSchema.index({ organization: 1, status: 1 });
organizationInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save hook to generate token
organizationInviteSchema.pre('validate', function(next) {
  if (this.isNew && !this.token) {
    this.token = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Methods
organizationInviteSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

organizationInviteSchema.methods.canResend = function() {
  if (this.status !== 'pending') return false;
  if (this.resendCount >= 3) return false;
  
  // Can resend after 1 hour
  if (this.lastResentAt) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.lastResentAt < hourAgo;
  }
  return true;
};

organizationInviteSchema.methods.accept = async function(userId) {
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = userId;
  return this.save();
};

organizationInviteSchema.methods.decline = async function() {
  this.status = 'declined';
  return this.save();
};

organizationInviteSchema.methods.resend = async function() {
  if (!this.canResend()) {
    throw new Error('Cannot resend invite at this time');
  }
  
  this.resendCount += 1;
  this.lastResentAt = new Date();
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Reset expiry
  return this.save();
};

// Statics
organizationInviteSchema.statics.findByToken = function(token) {
  return this.findOne({ 
    token, 
    status: 'pending',
    expiresAt: { $gt: new Date() }
  }).populate('organization', 'name slug logo');
};

organizationInviteSchema.statics.getPendingInvites = function(orgId) {
  return this.find({ 
    organization: orgId, 
    status: 'pending',
    expiresAt: { $gt: new Date() }
  })
    .populate('invitedBy', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

organizationInviteSchema.statics.getInviteByEmail = function(email, orgId) {
  return this.findOne({ 
    email: email.toLowerCase(), 
    organization: orgId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

organizationInviteSchema.statics.cancelExpiredInvites = async function() {
  return this.updateMany(
    { 
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    { 
      $set: { status: 'expired' }
    }
  );
};

const OrganizationInvite = mongoose.model('OrganizationInvite', organizationInviteSchema);

module.exports = OrganizationInvite;
