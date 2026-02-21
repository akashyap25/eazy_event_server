const mongoose = require('mongoose');
const crypto = require('crypto');

const TokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tokenType: {
    type: String,
    enum: ['access', 'refresh', 'password_reset', 'email_verification'],
    required: true
  },
  isBlacklisted: {
    type: Boolean,
    default: false,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String,
    maxlength: 500
  },
  ipAddress: {
    type: String,
    maxlength: 45 // IPv6 max length
  },
  deviceInfo: {
    type: String,
    maxlength: 200
  }
}, {
  timestamps: true
});

// Indexes for better performance
TokenSchema.index({ userId: 1, tokenType: 1 });
TokenSchema.index({ token: 1, isBlacklisted: 1 });
// expiresAt TTL index is already defined in schema definition

// Static method to create access token
TokenSchema.statics.createAccessToken = async function(userId, userAgent, ipAddress, deviceInfo) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  return this.create({
    userId,
    token,
    tokenType: 'access',
    expiresAt,
    userAgent,
    ipAddress,
    deviceInfo
  });
};

// Static method to create refresh token
TokenSchema.statics.createRefreshToken = async function(userId, userAgent, ipAddress, deviceInfo) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  return this.create({
    userId,
    token,
    tokenType: 'refresh',
    expiresAt,
    userAgent,
    ipAddress,
    deviceInfo
  });
};

// Static method to create password reset token
TokenSchema.statics.createPasswordResetToken = async function(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  return this.create({
    userId,
    token,
    tokenType: 'password_reset',
    expiresAt
  });
};

// Static method to create email verification token
TokenSchema.statics.createEmailVerificationToken = async function(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return this.create({
    userId,
    token,
    tokenType: 'email_verification',
    expiresAt
  });
};

// Method to check if token is valid
TokenSchema.methods.isValid = function() {
  return !this.isBlacklisted && this.expiresAt > new Date();
};

// Method to blacklist token
TokenSchema.methods.blacklist = function() {
  this.isBlacklisted = true;
  return this.save();
};

// Method to update last used
TokenSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Static method to blacklist all user tokens
TokenSchema.statics.blacklistAllUserTokens = async function(userId) {
  return this.updateMany(
    { userId, isBlacklisted: false },
    { isBlacklisted: true }
  );
};

// Static method to clean up expired tokens
TokenSchema.statics.cleanupExpiredTokens = async function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Static method to find valid token
TokenSchema.statics.findValidToken = async function(token, tokenType) {
  return this.findOne({
    token,
    tokenType,
    isBlacklisted: false,
    expiresAt: { $gt: new Date() }
  });
};

const Token = mongoose.model('Token', TokenSchema);

module.exports = Token;