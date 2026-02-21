const express = require('express');
const { createUser, getUserById, updateUser, deleteUser } = require('../controllers/userController');
const { authenticateToken, requireAuth, optionalAuth } = require('../middlewares/authMiddleware');
const { 
  generateTokenPair, 
  refreshAccessToken, 
  logout, 
  logoutAllDevices 
} = require('../middlewares/secureAuth');
const { csrfProtection, getCSRFToken } = require('../middlewares/csrfProtection');
const { 
  authRateLimit, 
  passwordResetRateLimit, 
  accountLockoutRateLimit 
} = require('../middlewares/rateLimiting');
const { validatePassword } = require('../config/security');
const User = require('../models/user');
const Token = require('../models/Token');
const PasswordReset = require('../models/PasswordReset');
const EmailService = require('../services/emailService');
const { body, validationResult } = require('express-validator');
const { validationSets, handleValidationErrors, commonValidations } = require("../utils/validationUtils");
// File upload middleware removed - not currently used

const router = express.Router();

// Use centralized validation sets
const validateRegistration = validationSets.registration;
const validateLogin = validationSets.login;

const validatePasswordChange = validationSets.passwordChange;

const validatePasswordReset = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
];

const validatePasswordResetConfirm = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    return true;
  })
];

// Public routes
router.post('/register', authRateLimit, validateRegistration, handleValidationErrors, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, username, firstName, lastName, avatar } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken',
        code: 'USER_EXISTS'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password,
      username,
      firstName,
      lastName,
      avatar: avatar || ''
    });

    // Generate token pair
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = `${req.get('User-Agent')} - ${ipAddress}`;
    
    const { accessToken, refreshToken } = await generateTokenPair(
      user._id, 
      userAgent, 
      ipAddress, 
      deviceInfo
    );

    // Send email verification
    try {
      const verificationToken = await Token.createEmailVerificationToken(user._id);
      await EmailService.sendEmailVerification(email, verificationToken.token, firstName);
    } catch (emailError) {
      console.error('Email verification error:', emailError);
      // Don't fail registration if email fails
    }
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/login', authRateLimit, accountLockoutRateLimit, validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts',
        code: 'ACCOUNT_LOCKED',
        lockoutUntil: user.lockoutUntil
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Handle failed login attempt
      await user.handleFailedLogin();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        failedAttempts: user.failedLoginAttempts
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Generate token pair
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = `${req.get('User-Agent')} - ${ipAddress}`;
    
    const { accessToken, refreshToken } = await generateTokenPair(
      user._id, 
      userAgent, 
      ipAddress, 
      deviceInfo
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      user,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// CSRF token endpoint
router.get('/csrf-token', getCSRFToken);

// Token refresh endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceInfo = `${req.get('User-Agent')} - ${ipAddress}`;
    
    const { accessToken } = await refreshAccessToken(refreshToken, userAgent, ipAddress, deviceInfo);
    
    res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

// Password reset request
router.post('/forgot-password', passwordResetRateLimit, validatePasswordReset, handleValidationErrors, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Check reset attempts
    const attemptsCount = await PasswordReset.getResetAttemptsCount(email);
    if (attemptsCount >= 3) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset attempts. Please try again later.',
        code: 'TOO_MANY_ATTEMPTS'
      });
    }

    // Create password reset request
    const resetRequest = await PasswordReset.createResetRequest(
      email, 
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent') || ''
    );

    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail(email, resetRequest.token, user.firstName);
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again later.'
      });
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
});

// Password reset confirmation
router.post('/reset-password', passwordResetRateLimit, validatePasswordResetConfirm, handleValidationErrors, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { token, newPassword } = req.body;

    // Find valid reset request
    const resetRequest = await PasswordReset.findValidRequest(token);
    if (!resetRequest) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN'
      });
    }

    // Find user
    const user = await User.findOne({ email: resetRequest.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Reset password
    try {
      await user.resetPassword(newPassword);
    } catch (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError.message,
        code: 'PASSWORD_VALIDATION_FAILED'
      });
    }

    // Mark reset request as used
    await resetRequest.markAsUsed();

    // Blacklist all user tokens for security
    await logoutAllDevices(user._id);

    // Send confirmation email
    try {
      await EmailService.sendPasswordChangedConfirmation(user.email, user.firstName);
    } catch (emailError) {
      console.error('Password changed confirmation email error:', emailError);
      // Don't fail the reset if email fails
    }

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Password reset confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, logout, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Logout all devices
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    await logoutAllDevices(req.user._id);
    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
    console.error('Logout all devices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to logout from all devices'
    });
  }
});

// Protected routes
router.get('/me', authenticateToken, requireAuth, (req, res) => {
  res.json(req.user);
});

// Password change endpoint
router.put('/:id/password', 
  authenticateToken, 
  requireAuth, 
  csrfProtection, 
  commonValidations.mongoId('id'),
  validatePasswordChange, 
  handleValidationErrors,
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.params.id;
    
    // Verify user can only change their own password
    if (req.auth.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only change your own password.',
        code: 'ACCESS_DENIED'
      });
    }
    
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    // Reset password with validation
    try {
      await user.resetPassword(newPassword);
    } catch (passwordError) {
      return res.status(400).json({
        success: false,
        message: passwordError.message,
        code: 'PASSWORD_VALIDATION_FAILED'
      });
    }

    // Blacklist all user tokens for security
    await logoutAllDevices(user._id);
    
    // Send confirmation email
    try {
      await EmailService.sendPasswordChangedConfirmation(user.email, user.firstName);
    } catch (emailError) {
      console.error('Password changed confirmation email error:', emailError);
      // Don't fail the password change if email fails
    }
    
    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.',
      requiresReauth: true
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

// Notification settings endpoint
router.put('/:id/notifications', authenticateToken, requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const notificationSettings = req.body;
    
    // Verify user can only update their own settings
    if (req.auth.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own settings.'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { notificationSettings },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings'
    });
  }
});

// Privacy settings endpoint
router.put('/:id/privacy', authenticateToken, requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const privacySettings = req.body;
    
    // Verify user can only update their own settings
    if (req.auth.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own settings.'
      });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { privacySettings },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating privacy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update privacy settings'
    });
  }
});

router.get('/:id', getUserById);
router.put('/:id', authenticateToken, requireAuth, updateUser);
router.delete('/:id', authenticateToken, requireAuth, deleteUser);

module.exports = router;
