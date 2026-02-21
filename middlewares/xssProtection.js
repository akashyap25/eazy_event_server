const helmet = require('helmet');
const xss = require('xss');
const DOMPurify = require('isomorphic-dompurify');

// XSS sanitization options
const xssOptions = {
  whiteList: {
    // Allow basic HTML tags
    p: [],
    br: [],
    strong: [],
    em: [],
    u: [],
    b: [],
    i: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    ul: [],
    ol: [],
    li: [],
    blockquote: [],
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    div: ['class'],
    span: ['class'],
    code: [],
    pre: [],
    table: [],
    thead: [],
    tbody: [],
    tr: [],
    td: [],
    th: []
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  css: false, // Disable CSS parsing for security
  allowList: {
    // Allow specific attributes
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    div: ['class'],
    span: ['class']
  }
};

// Sanitize HTML content
const sanitizeHTML = (html) => {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  try {
    // Use DOMPurify for server-side sanitization
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'b', 'i',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote',
        'a', 'img', 'div', 'span', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'target', 'src', 'alt', 'width', 'height', 'class'
      ],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false
    });
  } catch (error) {
    console.error('HTML sanitization error:', error);
    return '';
  }
};

// Sanitize text content (remove HTML tags)
const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

// Sanitize JSON data recursively
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    return sanitizeText(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        // Sanitize the key as well
        const cleanKey = sanitizeText(key);
        sanitized[cleanKey] = sanitizeData(data[key]);
      }
    }
    return sanitized;
  }
  
  return data;
};

// XSS protection middleware
const xssProtection = (req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeData(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeData(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeData(req.params);
  }
  
  next();
};

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'", // Only for development
      "https://cdn.jsdelivr.net",
      "https://unpkg.com"
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Allow inline styles
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "data:"
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https:",
      "blob:"
    ],
    connectSrc: [
      "'self'",
      "https://api.cloudinary.com",
      "https://api.stripe.com"
    ],
    mediaSrc: [
      "'self'",
      "https:",
      "blob:"
    ],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: []
  },
  reportOnly: process.env.NODE_ENV === 'development'
};

// Enhanced helmet configuration for XSS protection
const xssHelmetConfig = helmet({
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Input validation for specific fields
const validateAndSanitizeInput = (field, type = 'text') => {
  return (req, res, next) => {
    const value = req.body[field];
    
    if (value !== undefined && value !== null) {
      if (type === 'html') {
        req.body[field] = sanitizeHTML(value);
      } else if (type === 'text') {
        req.body[field] = sanitizeText(value);
      } else if (type === 'json') {
        req.body[field] = sanitizeData(value);
      }
    }
    
    next();
  };
};

// Rate limiting for file uploads
const uploadRateLimit = (req, res, next) => {
  // This would be implemented with express-rate-limit
  // For now, we'll just pass through
  next();
};

// File type validation for uploads
const validateFileType = (allowedTypes = ['image/jpeg', 'image/png', 'image/gif']) => {
  return (req, res, next) => {
    if (req.file) {
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type',
          allowedTypes: allowedTypes
        });
      }
    }
    next();
  };
};

// SQL injection protection (additional layer)
const sqlInjectionProtection = (req, res, next) => {
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\b(OR|AND)\s+['"]\s*=\s*['"])/gi,
    /(\bUNION\s+SELECT\b)/gi,
    /(\bDROP\s+TABLE\b)/gi,
    /(\bINSERT\s+INTO\b)/gi,
    /(\bDELETE\s+FROM\b)/gi,
    /(\bUPDATE\s+SET\b)/gi
  ];
  
  const checkForInjection = (obj) => {
    if (typeof obj === 'string') {
      for (const pattern of dangerousPatterns) {
        if (pattern.test(obj)) {
          return true;
        }
      }
    } else if (Array.isArray(obj)) {
      return obj.some(checkForInjection);
    } else if (obj && typeof obj === 'object') {
      return Object.values(obj).some(checkForInjection);
    }
    return false;
  };
  
  if (checkForInjection(req.body) || checkForInjection(req.query) || checkForInjection(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Potentially malicious input detected'
    });
  }
  
  next();
};

module.exports = {
  xssProtection,
  xssHelmetConfig,
  sanitizeHTML,
  sanitizeText,
  sanitizeData,
  validateAndSanitizeInput,
  uploadRateLimit,
  validateFileType,
  sqlInjectionProtection,
  cspConfig
};