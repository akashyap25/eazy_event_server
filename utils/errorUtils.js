/**
 * Centralized Error Handling Utilities
 * Consolidates all error response patterns to eliminate duplication
 */

const { createErrorResponse } = require('./validationUtils');

// Standard error responses
const errorResponses = {
  // 400 Bad Request
  badRequest: (message = 'Bad Request', errors = []) => 
    createErrorResponse(400, message, errors),

  // 401 Unauthorized
  unauthorized: (message = 'Unauthorized') => 
    createErrorResponse(401, message),

  // 403 Forbidden
  forbidden: (message = 'Access Denied') => 
    createErrorResponse(403, message),

  // 404 Not Found
  notFound: (message = 'Resource Not Found') => 
    createErrorResponse(404, message),

  // 409 Conflict
  conflict: (message = 'Resource Already Exists') => 
    createErrorResponse(409, message),

  // 422 Unprocessable Entity
  unprocessableEntity: (message = 'Validation Failed', errors = []) => 
    createErrorResponse(422, message, errors),

  // 429 Too Many Requests
  tooManyRequests: (message = 'Too Many Requests') => 
    createErrorResponse(429, message),

  // 500 Internal Server Error
  internalServerError: (message = 'Internal Server Error') => 
    createErrorResponse(500, message),

  // 503 Service Unavailable
  serviceUnavailable: (message = 'Service Unavailable') => 
    createErrorResponse(503, message)
};

// Error handler wrapper for async functions
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Try-catch wrapper for controllers
const tryCatch = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      console.error('Controller Error:', error);
      res.status(500).json(errorResponses.internalServerError(error.message));
    }
  };
};

// Database error handler
const handleDatabaseError = (error, res) => {
  console.error('Database Error:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    return res.status(422).json(errorResponses.unprocessableEntity('Validation failed', errors));
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json(errorResponses.badRequest('Invalid ID format'));
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res.status(409).json(errorResponses.conflict(`${field} already exists`));
  }
  
  return res.status(500).json(errorResponses.internalServerError('Database operation failed'));
};

// Authentication error handler
const handleAuthError = (error, res) => {
  console.error('Authentication Error:', error);
  
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json(errorResponses.unauthorized('Invalid token'));
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json(errorResponses.unauthorized('Token expired'));
  }
  
  return res.status(401).json(errorResponses.unauthorized('Authentication failed'));
};

// Rate limiting error handler
const handleRateLimitError = (req, res) => {
  return res.status(429).json(errorResponses.tooManyRequests('Too many requests, please try again later'));
};

// Validation error handler
const handleValidationError = (errors, res) => {
  const formattedErrors = errors.map(error => ({
    field: error.path,
    message: error.msg,
    value: error.value
  }));
  
  return res.status(400).json(errorResponses.badRequest('Validation failed', formattedErrors));
};

// File upload error handler
const handleFileUploadError = (error, res) => {
  console.error('File Upload Error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(errorResponses.badRequest('File too large'));
  }
  
  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(errorResponses.badRequest('Too many files'));
  }
  
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(errorResponses.badRequest('Unexpected file field'));
  }
  
  return res.status(500).json(errorResponses.internalServerError('File upload failed'));
};

// API error handler
const handleApiError = (error, res) => {
  console.error('API Error:', error);
  
  if (error.response) {
    // External API error
    const status = error.response.status;
    const message = error.response.data?.message || 'External API error';
    
    if (status >= 400 && status < 500) {
      return res.status(status).json(createErrorResponse(status, message));
    }
    
    return res.status(502).json(errorResponses.serviceUnavailable('External service error'));
  }
  
  if (error.request) {
    return res.status(503).json(errorResponses.serviceUnavailable('Service unavailable'));
  }
  
  return res.status(500).json(errorResponses.internalServerError('API request failed'));
};

// Generic error handler
const handleError = (error, req, res, next) => {
  console.error('Unhandled Error:', error);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const message = isDevelopment ? error.message : 'Something went wrong';
  
  res.status(500).json(createErrorResponse(500, message));
};

module.exports = {
  errorResponses,
  asyncHandler,
  tryCatch,
  handleDatabaseError,
  handleAuthError,
  handleRateLimitError,
  handleValidationError,
  handleFileUploadError,
  handleApiError,
  handleError
};