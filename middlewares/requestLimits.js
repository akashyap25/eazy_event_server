const express = require('express');
const rateLimit = require('express-rate-limit');

// Request size limits configuration
const REQUEST_LIMITS = {
  // JSON payload limits
  json: {
    limit: '10mb', // 10MB for JSON requests
    type: 'application/json'
  },
  // URL-encoded payload limits
  urlencoded: {
    limit: '10mb', // 10MB for URL-encoded requests
    type: 'application/x-www-form-urlencoded'
  },
  // Text payload limits
  text: {
    limit: '1mb', // 1MB for text requests
    type: 'text/plain'
  },
  // Raw payload limits
  raw: {
    limit: '5mb', // 5MB for raw requests
    type: 'application/octet-stream'
  },
  // Multipart form data limits (for file uploads)
  multipart: {
    limit: '50mb', // 50MB for multipart requests
    type: 'multipart/form-data'
  }
};

// DoS protection configuration
const DOS_PROTECTION = {
  // Maximum request size across all types
  maxRequestSize: '50mb',
  // Maximum number of parameters
  maxParams: 100,
  // Maximum number of headers
  maxHeaders: 50,
  // Maximum header value length
  maxHeaderValueLength: 4096,
  // Maximum URL length
  maxUrlLength: 2048,
  // Maximum query string length
  maxQueryLength: 2048
};

// Request size validation middleware
const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSize = parseSize(REQUEST_LIMITS.json.limit);
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large',
      error: {
        code: 'REQUEST_TOO_LARGE',
        maxSize: REQUEST_LIMITS.json.limit,
        actualSize: `${Math.round(contentLength / 1024 / 1024)}MB`
      }
    });
  }
  
  next();
};

// DoS protection middleware
const dosProtection = (req, res, next) => {
  // Check URL length
  if (req.originalUrl.length > DOS_PROTECTION.maxUrlLength) {
    return res.status(414).json({
      success: false,
      message: 'URI too long',
      error: {
        code: 'URI_TOO_LONG',
        maxLength: DOS_PROTECTION.maxUrlLength,
        actualLength: req.originalUrl.length
      }
    });
  }
  
  // Check query string length
  if (req.query && Object.keys(req.query).join('&').length > DOS_PROTECTION.maxQueryLength) {
    return res.status(414).json({
      success: false,
      message: 'Query string too long',
      error: {
        code: 'QUERY_TOO_LONG',
        maxLength: DOS_PROTECTION.maxQueryLength
      }
    });
  }
  
  // Check number of parameters
  const paramCount = Object.keys(req.params).length + Object.keys(req.query).length;
  if (paramCount > DOS_PROTECTION.maxParams) {
    return res.status(400).json({
      success: false,
      message: 'Too many parameters',
      error: {
        code: 'TOO_MANY_PARAMS',
        maxParams: DOS_PROTECTION.maxParams,
        actualParams: paramCount
      }
    });
  }
  
  // Check number of headers
  const headerCount = Object.keys(req.headers).length;
  if (headerCount > DOS_PROTECTION.maxHeaders) {
    return res.status(400).json({
      success: false,
      message: 'Too many headers',
      error: {
        code: 'TOO_MANY_HEADERS',
        maxHeaders: DOS_PROTECTION.maxHeaders,
        actualHeaders: headerCount
      }
    });
  }
  
  // Check header value lengths
  for (const [key, value] of Object.entries(req.headers)) {
    if (value && value.length > DOS_PROTECTION.maxHeaderValueLength) {
      return res.status(400).json({
        success: false,
        message: 'Header value too long',
        error: {
          code: 'HEADER_VALUE_TOO_LONG',
          header: key,
          maxLength: DOS_PROTECTION.maxHeaderValueLength,
          actualLength: value.length
        }
      });
    }
  }
  
  next();
};

// Request timeout middleware
const requestTimeout = (timeoutMs = 30000) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout',
          error: {
            code: 'REQUEST_TIMEOUT',
            timeout: timeoutMs
          }
        });
      }
    }, timeoutMs);
    
    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
};

// Memory usage monitoring
const memoryMonitor = (req, res, next) => {
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const endMemory = process.memoryUsage();
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;
    
    // Log high memory usage
    if (memoryDiff > 50 * 1024 * 1024) { // 50MB
      console.warn(`[MEMORY WARNING] High memory usage for ${req.method} ${req.originalUrl}: ${Math.round(memoryDiff / 1024 / 1024)}MB`);
    }
  });
  
  next();
};

// Request rate limiting by endpoint complexity
const getEndpointRateLimit = (endpoint) => {
  const complexEndpoints = [
    '/api/events/create',
    '/api/events/update',
    '/api/users/register',
    '/api/users/login'
  ];
  
  const heavyEndpoints = [
    '/api/events/search',
    '/api/events/export',
    '/api/users/export'
  ];
  
  if (heavyEndpoints.includes(endpoint)) {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // 10 requests per window
      message: 'Too many requests for this heavy endpoint'
    };
  }
  
  if (complexEndpoints.includes(endpoint)) {
    return {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 20, // 20 requests per window
      message: 'Too many requests for this complex endpoint'
    };
  }
  
  return {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests'
  };
};

// Dynamic rate limiting based on endpoint
const dynamicRateLimit = (req, res, next) => {
  const endpoint = req.originalUrl.split('?')[0]; // Remove query params
  const rateLimitConfig = getEndpointRateLimit(endpoint);
  
  const limiter = rateLimit({
    ...rateLimitConfig,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: rateLimitConfig.message,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          endpoint: endpoint,
          retryAfter: Math.round(rateLimitConfig.windowMs / 1000)
        }
      });
    }
  });
  
  limiter(req, res, next);
};

// Utility function to parse size strings
function parseSize(size) {
  const units = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  return value * units[unit];
}

module.exports = {
  REQUEST_LIMITS,
  DOS_PROTECTION,
  validateRequestSize,
  dosProtection,
  requestTimeout,
  memoryMonitor,
  dynamicRateLimit,
  getEndpointRateLimit
};