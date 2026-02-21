const rateLimit = require('express-rate-limit');
const { User } = require('../models/user');

// User-based rate limiting configuration
const USER_RATE_LIMITS = {
  // Free tier users
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window (increased for development)
    message: 'Free tier rate limit exceeded'
  },
  // Premium tier users
  premium: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // 2000 requests per window (increased for development)
    message: 'Premium tier rate limit exceeded'
  },
  // Admin users
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // 10000 requests per window (increased for development)
    message: 'Admin rate limit exceeded'
  },
  // Unauthenticated users
  anonymous: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window (increased for development)
    message: 'Anonymous user rate limit exceeded'
  }
};

// Endpoint-specific rate limits
const ENDPOINT_RATE_LIMITS = {
  // Authentication endpoints
  '/api/users/login': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window
    message: 'Too many login attempts'
  },
  '/api/users/register': {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour
    message: 'Too many registration attempts'
  },
  '/api/users/forgot-password': {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts'
  },
  '/api/users/reset-password': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 password reset confirmations per window
    message: 'Too many password reset confirmations'
  },
  // Event creation endpoints
  '/api/events/create': {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 events per hour
    message: 'Too many event creation attempts'
  },
  '/api/events/update': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 updates per window
    message: 'Too many event update attempts'
  },
  // File upload endpoints
  '/api/upload': {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: 'Too many file upload attempts'
  },
  // Search endpoints
  '/api/events/search': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 searches per window
    message: 'Too many search requests'
  }
};

// Get user tier from request
const getUserTier = async (req) => {
  if (!req.auth || !req.auth.userId) {
    return 'anonymous';
  }
  
  try {
    const user = await User.findById(req.auth.userId).select('tier role');
    if (!user) {
      return 'anonymous';
    }
    
    // Check if user is admin
    if (user.role === 'admin') {
      return 'admin';
    }
    
    // Return user tier or default to free
    return user.tier || 'free';
  } catch (error) {
    console.error('Error getting user tier:', error);
    return 'anonymous';
  }
};

// Get rate limit config for user and endpoint
const getRateLimitConfig = async (req) => {
  const userTier = await getUserTier(req);
  const endpoint = req.originalUrl.split('?')[0]; // Remove query params
  
  // Check for endpoint-specific limits
  if (ENDPOINT_RATE_LIMITS[endpoint]) {
    return {
      ...ENDPOINT_RATE_LIMITS[endpoint],
      userTier: userTier,
      endpoint: endpoint
    };
  }
  
  // Return user tier limits
  return {
    ...USER_RATE_LIMITS[userTier],
    userTier: userTier,
    endpoint: 'general'
  };
};

// User-based rate limiting middleware
const userRateLimit = async (req, res, next) => {
  try {
    const config = await getRateLimitConfig(req);
    
    // Create rate limiter with user-specific key
    const userKey = req.auth?.userId || req.ip;
    const keyGenerator = () => `${userKey}:${config.endpoint}`;
    
    const limiter = rateLimit({
      ...config,
      keyGenerator: keyGenerator,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          message: config.message,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            userTier: config.userTier,
            endpoint: config.endpoint,
            retryAfter: Math.round(config.windowMs / 1000),
            limit: config.max,
            windowMs: config.windowMs
          }
        });
      }
    });
    
    limiter(req, res, next);
  } catch (error) {
    console.error('Error in user rate limiting:', error);
    next();
  }
};

// Burst rate limiting for high-frequency endpoints
const burstRateLimit = (maxRequests = 10, windowMs = 60000) => {
  return rateLimit({
    windowMs: windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Burst rate limit exceeded',
        error: {
          code: 'BURST_RATE_LIMIT_EXCEEDED',
          maxRequests: maxRequests,
          windowMs: windowMs,
          retryAfter: Math.round(windowMs / 1000)
        }
      });
    }
  });
};

// Adaptive rate limiting based on user behavior
const adaptiveRateLimit = async (req, res, next) => {
  try {
    const userTier = await getUserTier(req);
    const userId = req.auth?.userId;
    
    if (!userId) {
      return next();
    }
    
    // Get user's recent request history
    const recentRequests = await getUserRecentRequests(userId);
    
    // Calculate adaptive limits based on user behavior
    let multiplier = 1;
    
    // Reduce limits for users with high error rates
    if (recentRequests.errorRate > 0.1) { // 10% error rate
      multiplier = 0.5;
    }
    
    // Increase limits for users with good behavior
    if (recentRequests.errorRate < 0.01 && recentRequests.totalRequests > 100) { // 1% error rate
      multiplier = 1.5;
    }
    
    // Apply adaptive limits
    const baseConfig = USER_RATE_LIMITS[userTier];
    const adaptiveConfig = {
      ...baseConfig,
      max: Math.floor(baseConfig.max * multiplier)
    };
    
    const limiter = rateLimit({
      ...adaptiveConfig,
      keyGenerator: () => `adaptive:${userId}`,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Adaptive rate limit exceeded',
          error: {
            code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
            userTier: userTier,
            multiplier: multiplier,
            retryAfter: Math.round(adaptiveConfig.windowMs / 1000)
          }
        });
      }
    });
    
    limiter(req, res, next);
  } catch (error) {
    console.error('Error in adaptive rate limiting:', error);
    next();
  }
};

// Get user's recent request history (mock implementation)
const getUserRecentRequests = async (userId) => {
  // In a real implementation, this would query a database
  // For now, return mock data
  return {
    totalRequests: 50,
    errorRate: 0.02, // 2% error rate
    lastRequest: new Date()
  };
};

// Rate limit bypass for trusted sources
const trustedSourceBypass = (req, res, next) => {
  const trustedSources = [
    process.env.ADMIN_IP,
    process.env.MONITORING_IP
  ].filter(Boolean);
  
  const clientIP = req.ip;
  
  if (trustedSources.includes(clientIP)) {
    // Skip rate limiting for trusted sources
    return next();
  }
  
  next();
};

// Rate limit status endpoint
const getRateLimitStatus = async (req, res) => {
  try {
    const userTier = await getUserTier(req);
    const config = await getRateLimitConfig(req);
    
    res.json({
      success: true,
      data: {
        userTier: userTier,
        rateLimit: {
          limit: config.max,
          windowMs: config.windowMs,
          remaining: res.get('X-RateLimit-Remaining') || 'unknown',
          reset: res.get('X-RateLimit-Reset') || 'unknown'
        },
        endpoint: config.endpoint
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit status',
      error: error.message
    });
  }
};

module.exports = {
  USER_RATE_LIMITS,
  ENDPOINT_RATE_LIMITS,
  userRateLimit,
  burstRateLimit,
  adaptiveRateLimit,
  trustedSourceBypass,
  getRateLimitStatus,
  getUserTier
};