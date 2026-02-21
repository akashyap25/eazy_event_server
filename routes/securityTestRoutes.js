const express = require('express');
const { sanitizeInput, handleValidationErrors, commonValidations } = require("../utils/validationUtils");
const { uploadSingle, cleanupOnError } = require('../middlewares/fileUploadSecurity');
const { xssProtection, sqlInjectionProtection } = require('../middlewares/xssProtection');
const { authenticateToken, requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Test endpoint for XSS protection
router.post('/test-xss', (req, res) => {
  const { content } = req.body;
  
  res.json({
    success: true,
    original: content,
    sanitized: content,
    message: 'XSS protection test completed'
  });
});

// Test endpoint for SQL injection protection
router.post('/test-sql-injection', (req, res) => {
  const { query } = req.body;
  
  res.json({
    success: true,
    query: query,
    message: 'SQL injection protection test completed'
  });
});

// Test endpoint for file upload security
router.post('/test-file-upload', 
  uploadSingle('file', ['image/jpeg', 'image/png', 'image/gif']),
  cleanupOnError,
  (req, res) => {
    res.json({
      success: true,
      file: req.file ? {
        originalname: req.file.originalname,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null,
      message: 'File upload security test completed'
    });
  }
);

// Test endpoint for input validation
router.post('/test-validation',
  commonValidations.stringLength('testField', 1, 100),
  handleValidationErrors,
  (req, res) => {
    res.json({
      success: true,
      data: req.body,
      message: 'Input validation test completed'
    });
  }
);

// Test endpoint for authentication
router.get('/test-auth',
  authenticateToken,
  requireAuth,
  (req, res) => {
    res.json({
      success: true,
      user: req.user,
      message: 'Authentication test completed'
    });
  }
);

// Test endpoint for rate limiting (this will be rate limited)
router.get('/test-rate-limit', (req, res) => {
  res.json({
    success: true,
    message: 'Rate limiting test completed',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;