const cors = require('cors');

// Environment-based CORS configuration
const getCorsConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Allowed origins based on environment
  const allowedOrigins = isDevelopment 
    ? [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173'
      ]
    : [
        process.env.FRONTEND_URL || 'https://yourdomain.com',
        process.env.ADMIN_URL || 'https://admin.yourdomain.com'
      ];

  // CORS options configuration
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // In development, allow any localhost origin
      if (isDevelopment && origin.includes('localhost')) {
        return callback(null, true);
      }
      
      // Reject origin
      const error = new Error('Not allowed by CORS');
      error.status = 403;
      return callback(error, false);
    },
    
    credentials: true, // Allow cookies and authorization headers
    
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'X-API-Key',
      'X-API-Version',
      'X-Request-ID',
      'X-CSRF-Token'
    ],
    
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Current-Page',
      'X-Per-Page',
      'X-Rate-Limit-Limit',
      'X-Rate-Limit-Remaining',
      'X-Rate-Limit-Reset',
      'API-Version',
      'API-Version-Status'
    ],
    
    maxAge: isDevelopment ? 0 : 86400, // 24 hours in production, no cache in development
    
    preflightContinue: false,
    
    optionsSuccessStatus: 200
  };
  
  return corsOptions;
};

// CORS error handler
const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: {
        code: 'CORS_ERROR',
        origin: req.get('Origin') || 'unknown',
        allowedOrigins: process.env.NODE_ENV === 'development' 
          ? ['http://localhost:3000', 'http://localhost:5173'] 
          : [process.env.FRONTEND_URL || 'https://yourdomain.com']
      }
    });
  }
  
  next(err);
};

// CORS preflight handler
const corsPreflightHandler = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Add security headers for preflight
    res.set({
      'Access-Control-Allow-Origin': req.get('Origin') || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, X-API-Key, X-API-Version, X-Request-ID, X-CSRF-Token',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true'
    });
    
    return res.status(200).end();
  }
  
  next();
};

// Security headers for CORS
const corsSecurityHeaders = (req, res, next) => {
  const origin = req.get('Origin');
  
  if (origin) {
    // Validate origin format
    const originRegex = /^https?:\/\/([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(:\d+)?$/;
    if (!originRegex.test(origin)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid origin format',
        error: {
          code: 'INVALID_ORIGIN',
          origin: origin
        }
      });
    }
    
    // Set CORS headers
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin'
    });
  }
  
  next();
};

// CORS logging middleware
const corsLogger = (req, res, next) => {
  const origin = req.get('Origin');
  const userAgent = req.get('User-Agent');
  
  if (origin) {
    console.log(`[CORS] Request from origin: ${origin}, User-Agent: ${userAgent}, Method: ${req.method}, Path: ${req.originalUrl}`);
  }
  
  next();
};

// CORS rate limiting by origin
const corsRateLimit = (req, res, next) => {
  const origin = req.get('Origin');
  
  if (!origin) {
    return next();
  }
  
  // Simple in-memory rate limiting by origin
  const originLimits = new Map();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 1000; // 1000 requests per window per origin
  
  const originKey = origin;
  const originData = originLimits.get(originKey) || { count: 0, resetTime: now + windowMs };
  
  // Reset if window has passed
  if (now > originData.resetTime) {
    originData.count = 0;
    originData.resetTime = now + windowMs;
  }
  
  // Check if limit exceeded
  if (originData.count >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests from this origin',
      error: {
        code: 'ORIGIN_RATE_LIMIT_EXCEEDED',
        origin: origin,
        retryAfter: Math.round((originData.resetTime - now) / 1000)
      }
    });
  }
  
  // Increment counter
  originData.count++;
  originLimits.set(originKey, originData);
  
  next();
};

module.exports = {
  getCorsConfig,
  corsErrorHandler,
  corsPreflightHandler,
  corsSecurityHeaders,
  corsLogger,
  corsRateLimit
};