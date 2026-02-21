const crypto = require('crypto');
const { securityConfig } = require('../config/security');

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API routes that don't need it (like webhooks)
  if (req.path.startsWith('/api/webhooks/') || req.path.startsWith('/api/health')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(sessionToken))) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  next();
};

// Generate CSRF token
const generateCSRFToken = (req, res, next) => {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  // Make CSRF token available to frontend
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

// Get CSRF token endpoint
const getCSRFToken = (req, res) => {
  if (!req.session) {
    return res.status(500).json({
      success: false,
      message: 'Session not available'
    });
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.json({
    success: true,
    csrfToken: req.session.csrfToken
  });
};

module.exports = {
  csrfProtection,
  generateCSRFToken,
  getCSRFToken
};