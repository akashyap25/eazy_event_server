const express = require('express');
const { authenticateToken, requireAuth } = require('../../middlewares/authMiddleware');
const { validationSets, handleValidationErrors, commonValidations } = require('../../utils/validationUtils');
const { 
  authRateLimit, 
  passwordResetRateLimit, 
  accountLockoutRateLimit 
} = require('../../middlewares/rateLimiting');
const { validatePassword } = require('../../config/security');
const User = require('../../models/user');
const Token = require('../../models/Token');
const PasswordReset = require('../../models/PasswordReset');
const EmailService = require('../../services/emailService');
const { body, validationResult } = require('express-validator');
const { 
  generateTokenPair, 
  refreshAccessToken, 
  logout, 
  logoutAllDevices 
} = require('../../middlewares/secureAuth');
const { csrfProtection, getCSRFToken } = require('../../middlewares/csrfProtection');

const router = express.Router();

// Use centralized validation sets
const validateRegistration = validationSets.registration;
const validateLogin = validationSets.login;

const validatePasswordChange = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').custom((value) => {
    const validation = validatePassword(value);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    return true;
  })
];

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
    const { email, password, username, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
        error: {
          code: 'USER_EXISTS',
          field: existingUser.email === email ? 'email' : 'username'
        }
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      username,
      firstName,
      lastName,
      isEmailVerified: false
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user._id);

    // Send email verification
    try {
      await EmailService.sendVerificationEmail(user.email, user._id);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

router.post('/login', authRateLimit, accountLockoutRateLimit, validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: { code: 'INVALID_CREDENTIALS' }
      });
    }

    // Check if account is locked
    if (await user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts',
        error: { code: 'ACCOUNT_LOCKED' }
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated',
        error: { code: 'ACCOUNT_DEACTIVATED' }
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.handleFailedLogin();
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        error: { code: 'INVALID_CREDENTIALS' }
      });
    }

    // Update last login and reset failed attempts
    user.updateLastLogin();
    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokenPair(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
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
        error: { code: 'REFRESH_TOKEN_REQUIRED' }
      });
    }

    const result = await refreshAccessToken(refreshToken);
    
    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error: { code: 'INVALID_REFRESH_TOKEN' }
      });
    }

    res.json({
      success: true,
      accessToken: result.accessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: { code: 'INVALID_REFRESH_TOKEN' }
    });
  }
});

// Password reset request
router.post('/forgot-password', passwordResetRateLimit, validatePasswordReset, handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Create password reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    const passwordReset = new PasswordReset({
      userId: user._id,
      token: resetToken,
      expiresAt
    });

    await passwordReset.save();

    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
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
    const { token, newPassword } = req.body;

    const passwordReset = await PasswordReset.findOne({
      token,
      expiresAt: { $gt: new Date() },
      used: false
    });

    if (!passwordReset) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
        error: { code: 'INVALID_RESET_TOKEN' }
      });
    }

    const user = await User.findById(passwordReset.userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' }
      });
    }

    // Reset password
    await user.resetPassword(newPassword);
    await user.save();

    // Mark token as used
    passwordReset.used = true;
    await passwordReset.save();

    // Blacklist all user tokens
    await Token.updateMany(
      { userId: user._id },
      { isBlacklisted: true }
    );

    // Send confirmation email
    try {
      await EmailService.sendPasswordChangedEmail(user.email);
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Password reset confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
});

// Logout endpoints
router.post('/logout', authenticateToken, logout, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    await logoutAllDevices(req, res, () => {});
    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
  } catch (error) {
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
    const { currentPassword, newPassword } = req.body;
    const userId = req.params.id;

    // Check authorization
    if (req.auth.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to change this password',
        error: { code: 'UNAUTHORIZED' }
      });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: { code: 'USER_NOT_FOUND' }
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        error: { code: 'INVALID_CURRENT_PASSWORD' }
      });
    }

    // Reset password with new password
    await user.resetPassword(newPassword);
    await user.save();

    // Blacklist all user tokens
    await Token.updateMany(
      { userId: user._id },
      { isBlacklisted: true }
    );

    // Send password changed confirmation email
    try {
      await EmailService.sendPasswordChangedEmail(user.email);
    } catch (emailError) {
      console.error('Failed to send password changed email:', emailError);
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
      requiresReauth: true
    });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
});

module.exports = router;