const mongoose = require('mongoose');
const crypto = require('crypto');

const PasswordResetSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hashedToken: {
    type: String,
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  usedAt: {
    type: Date
  },
  ipAddress: {
    type: String,
    maxlength: 45
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
PasswordResetSchema.index({ email: 1, isUsed: 1 });
PasswordResetSchema.index({ hashedToken: 1, isUsed: 1 });
// expiresAt TTL index is already defined in schema definition

// Static method to create password reset request
PasswordResetSchema.statics.createResetRequest = async function(email, ipAddress, userAgent) {
  // Check for existing unused tokens for this email
  const existingRequest = await this.findOne({
    email,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
  
  if (existingRequest) {
    // Increment attempts if request exists
    existingRequest.attempts += 1;
    await existingRequest.save();
    return existingRequest;
  }
  
  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  // Set expiration time (15 minutes)
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  
  // Create new request
  const resetRequest = new this({
    email,
    token,
    hashedToken,
    expiresAt,
    ipAddress,
    userAgent
  });
  
  return resetRequest.save();
};

// Static method to find valid reset request
PasswordResetSchema.statics.findValidRequest = async function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    hashedToken,
    isUsed: false,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: 3 }
  });
};

// Method to mark as used
PasswordResetSchema.methods.markAsUsed = function() {
  this.isUsed = true;
  this.usedAt = new Date();
  return this.save();
};

// Method to increment attempts
PasswordResetSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Static method to clean up expired requests
PasswordResetSchema.statics.cleanupExpiredRequests = async function() {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { isUsed: true, usedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Clean up used requests older than 24 hours
    ]
  });
};

// Static method to get reset attempts count for email
PasswordResetSchema.statics.getResetAttemptsCount = async function(email, timeWindow = 60 * 60 * 1000) { // 1 hour default
  const since = new Date(Date.now() - timeWindow);
  
  return this.countDocuments({
    email,
    createdAt: { $gte: since }
  });
};

const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);

module.exports = PasswordReset;