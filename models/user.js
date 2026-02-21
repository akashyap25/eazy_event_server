const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8
  },
  passwordHistory: [{
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  passwordChangedAt: { type: Date },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date },
  isLocked: { type: Boolean, default: false },
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 50
  },
  avatar: { 
    type: String, 
    default: '',
    trim: true
  },
  isEmailVerified: { 
    type: Boolean, 
    default: false 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin', 'moderator'], 
    default: 'user' 
  },
  lastLogin: { 
    type: Date 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  notificationSettings: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    eventReminders: { type: Boolean, default: true },
    taskUpdates: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  },
  privacySettings: {
    profileVisibility: { 
      type: String, 
      enum: ['public', 'friends', 'private'], 
      default: 'public' 
    },
    showEmail: { type: Boolean, default: false },
    showPhone: { type: Boolean, default: false },
    allowMessages: { type: Boolean, default: true }
  }
}, { 
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    // Store current hashed password in history before updating
    if (this.password && this.passwordHistory.length > 0) {
      this.passwordHistory.push({
        password: this.password, // This is already hashed
        createdAt: new Date()
      });
      
      // Keep only last 5 passwords
      if (this.passwordHistory.length > 5) {
        this.passwordHistory = this.passwordHistory.slice(-5);
      }
    }
    
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if password was used recently
UserSchema.methods.isPasswordRecentlyUsed = async function(candidatePassword) {
  for (const historyItem of this.passwordHistory) {
    const isMatch = await bcrypt.compare(candidatePassword, historyItem.password);
    if (isMatch) {
      return true;
    }
  }
  return false;
};

// Update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.failedLoginAttempts = 0; // Reset failed attempts on successful login
  this.isLocked = false;
  this.lockoutUntil = undefined;
  return this.save();
};

// Handle failed login attempt
UserSchema.methods.handleFailedLogin = async function() {
  this.failedLoginAttempts += 1;
  
  const { accountLockout } = require('../config/security').securityConfig;
  
  if (this.failedLoginAttempts >= accountLockout.maxFailedAttempts) {
    this.isLocked = true;
    this.lockoutUntil = new Date(Date.now() + accountLockout.lockoutDuration);
  }
  
  return this.save();
};

// Check if account is locked
UserSchema.methods.isAccountLocked = function() {
  if (!this.isLocked) return false;
  
  if (this.lockoutUntil && this.lockoutUntil > new Date()) {
    return true;
  }
  
  // Unlock account if lockout period has passed
  this.isLocked = false;
  this.lockoutUntil = undefined;
  this.failedLoginAttempts = 0;
  this.save();
  
  return false;
};

// Reset password with validation
UserSchema.methods.resetPassword = async function(newPassword) {
  // Check if new password is different from current
  const isCurrentPassword = await this.comparePassword(newPassword);
  if (isCurrentPassword) {
    throw new Error('New password must be different from current password');
  }
  
  // Check if password was used recently
  const wasRecentlyUsed = await this.isPasswordRecentlyUsed(newPassword);
  if (wasRecentlyUsed) {
    throw new Error('Password was used recently. Please choose a different password');
  }
  
  // Update password
  this.password = newPassword;
  this.passwordChangedAt = new Date();
  this.failedLoginAttempts = 0;
  this.isLocked = false;
  this.lockoutUntil = undefined;
  
  return this.save();
};

const User = mongoose.model('User', UserSchema);

module.exports = User;