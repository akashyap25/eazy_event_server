const crypto = require('crypto');

// Security configuration
const securityConfig = {
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || (() => {
      console.warn('⚠️  WARNING: JWT_SECRET not set in environment variables. Using generated secret for development only.');
      return crypto.randomBytes(64).toString('hex');
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m', // Short-lived access tokens
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // Long-lived refresh tokens
    issuer: process.env.JWT_ISSUER || 'eazy-event-app',
    audience: process.env.JWT_AUDIENCE || 'eazy-event-users'
  },

  // Password Policy
  passwordPolicy: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxConsecutiveChars: 3,
    forbiddenPasswords: [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
      'qwerty123', 'dragon', 'master', 'hello', 'freedom', 'whatever',
      'qazwsx', 'trustno1', 'jordan23', 'harley', 'ranger', 'hunter',
      'buster', 'soccer', 'hockey', 'killer', 'george', 'sexy', 'andrew',
      'charlie', 'superman', 'asshole', 'fuckyou', 'dallas', 'jessica',
      'panties', 'pepper', '1234', 'zxcvbn', 'qwertyuiop', 'asdfghjkl',
      'zxcvbnm', 'password', '12345678', 'qwerty', 'abc123', 'password123'
    ]
  },

  // Rate Limiting
  rateLimits: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per window
      message: 'Too many authentication attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true
    },
    general: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per window (increased for development)
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 password reset attempts per hour
      message: 'Too many password reset attempts, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  // CSRF Configuration
  csrf: {
    secret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    }
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Password Reset
  passwordReset: {
    tokenExpiry: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 3,
    cooldownPeriod: 60 * 60 * 1000 // 1 hour
  },

  // Account Lockout
  accountLockout: {
    maxFailedAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    resetAttemptsAfter: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Password validation function
const validatePassword = (password) => {
  const policy = securityConfig.passwordPolicy;
  const errors = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters long`);
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must be no more than ${policy.maxLength} characters long`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for consecutive characters
  if (policy.maxConsecutiveChars) {
    const consecutiveRegex = new RegExp(`(.)\\1{${policy.maxConsecutiveChars},}`, 'i');
    if (consecutiveRegex.test(password)) {
      errors.push(`Password cannot contain more than ${policy.maxConsecutiveChars} consecutive identical characters`);
    }
  }

  // Check against forbidden passwords
  if (policy.forbiddenPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common and not allowed');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Generate secure random token
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate password reset token
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Hash password reset token for storage
const hashPasswordResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  securityConfig,
  validatePassword,
  generateSecureToken,
  generatePasswordResetToken,
  hashPasswordResetToken
};