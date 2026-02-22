const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  description: {
    type: String,
    maxlength: 500
  },
  logo: { 
    type: String 
  },
  domain: { 
    type: String,
    lowercase: true
  },
  website: {
    type: String
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  settings: {
    branding: {
      primaryColor: { type: String, default: '#6366f1' },
      secondaryColor: { type: String, default: '#8b5cf6' },
      logoPosition: { type: String, enum: ['left', 'center'], default: 'left' }
    },
    defaults: {
      eventVisibility: { 
        type: String, 
        enum: ['public', 'organization', 'private'], 
        default: 'organization' 
      },
      allowPublicEvents: { type: Boolean, default: true },
      requireApproval: { type: Boolean, default: false }
    },
    limits: {
      maxEvents: { type: Number, default: 100 },
      maxMembers: { type: Number, default: 50 },
      maxStorage: { type: Number, default: 5000 } // MB
    },
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      slackIntegration: { type: String },
      webhookUrl: { type: String }
    }
  },
  plan: { 
    type: String, 
    enum: ['free', 'starter', 'pro', 'enterprise'], 
    default: 'free' 
  },
  subscription: {
    status: { 
      type: String, 
      enum: ['active', 'cancelled', 'past_due', 'trialing'], 
      default: 'active' 
    },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    currentPeriodEnd: { type: Date },
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  usage: {
    eventsCreated: { type: Number, default: 0 },
    totalAttendees: { type: Number, default: 0 },
    storageUsed: { type: Number, default: 0 }
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, { timestamps: true });

// Indexes
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ owner: 1 });
organizationSchema.index({ isActive: 1, isDeleted: 1 });
organizationSchema.index({ plan: 1 });
organizationSchema.index({ name: 'text', description: 'text' });

// Generate slug from name
organizationSchema.pre('validate', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Virtual for member count (populated separately)
organizationSchema.virtual('memberCount', {
  ref: 'OrganizationMember',
  localField: '_id',
  foreignField: 'organization',
  count: true
});

// Methods
organizationSchema.methods.canCreateEvent = function() {
  const limits = {
    free: 10,
    starter: 50,
    pro: 200,
    enterprise: Infinity
  };
  return this.usage.eventsCreated < (limits[this.plan] || 10);
};

organizationSchema.methods.canAddMember = function() {
  const limits = {
    free: 5,
    starter: 20,
    pro: 100,
    enterprise: Infinity
  };
  return this.settings.limits.maxMembers < (limits[this.plan] || 5);
};

// Statics
organizationSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, isDeleted: false, isActive: true });
};

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
