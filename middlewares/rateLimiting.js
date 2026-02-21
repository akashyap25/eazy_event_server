const rateLimit = require('express-rate-limit');
const { securityConfig } = require('../config/security');

// Authentication rate limiting
const authRateLimit = rateLimit({
  ...securityConfig.rateLimits.auth,
  keyGenerator: (req) => {
    // Use IP + email for more granular rate limiting on auth endpoints
    const email = req.body?.email || 'unknown';
    return `${req.ip}-${email}`;
  },
  skip: (req) => {
    // Skip rate limiting for successful requests
    return req.auth?.userId;
  }
});

// Password reset rate limiting
const passwordResetRateLimit = rateLimit({
  ...securityConfig.rateLimits.passwordReset,
  keyGenerator: (req) => {
    // Use IP + email for password reset attempts
    const email = req.body?.email || 'unknown';
    return `${req.ip}-${email}`;
  }
});

// General API rate limiting
const generalRateLimit = rateLimit(securityConfig.rateLimits.general);

// Account lockout rate limiting (for failed login attempts)
const accountLockoutRateLimit = rateLimit({
  windowMs: securityConfig.accountLockout.lockoutDuration,
  max: securityConfig.accountLockout.maxFailedAttempts,
  message: {
    success: false,
    message: 'Too many failed login attempts. Account temporarily locked.',
    code: 'ACCOUNT_LOCKED',
    lockoutDuration: securityConfig.accountLockout.lockoutDuration
  },
  keyGenerator: (req) => {
    const email = req.body?.email || 'unknown';
    return `lockout-${req.ip}-${email}`;
  },
  skip: (req) => {
    // Skip if user is already authenticated
    return req.auth?.userId;
  }
});

// Create custom rate limiter for specific endpoints
const createCustomRateLimit = (config) => {
  return rateLimit({
    ...config,
    standardHeaders: true,
    legacyHeaders: false
  });
};

module.exports = {
  authRateLimit,
  passwordResetRateLimit,
  generalRateLimit,
  accountLockoutRateLimit,
  createCustomRateLimit
};