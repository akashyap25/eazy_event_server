const express = require('express');

// API Version configuration
const API_VERSIONS = {
  v1: {
    version: '1.0.0',
    status: 'current',
    deprecationDate: null,
    sunsetDate: null,
    description: 'Current stable API version'
  },
  v2: {
    version: '2.0.0',
    status: 'beta',
    deprecationDate: null,
    sunsetDate: null,
    description: 'Beta API version with new features'
  }
};

// Default version
const DEFAULT_VERSION = 'v1';

// Version validation middleware
const validateApiVersion = (req, res, next) => {
  // Skip versioning for non-versioned routes
  if (req.originalUrl.includes('/api/versions')) {
    return next();
  }
  
  const version = req.params.version || req.headers['api-version'] || DEFAULT_VERSION;
  
  // Check if version exists
  if (!API_VERSIONS[version]) {
    return res.status(400).json({
      success: false,
      message: 'Invalid API version',
      error: {
        code: 'INVALID_VERSION',
        providedVersion: version,
        supportedVersions: Object.keys(API_VERSIONS),
        defaultVersion: DEFAULT_VERSION
      }
    });
  }

  // Check if version is deprecated
  const versionInfo = API_VERSIONS[version];
  if (versionInfo.status === 'deprecated') {
    res.set('API-Version-Status', 'deprecated');
    res.set('API-Version-Deprecation-Date', versionInfo.deprecationDate);
    res.set('API-Version-Sunset-Date', versionInfo.sunsetDate);
    
    // Add warning header
    res.set('Warning', `299 - "API version ${version} is deprecated. Please upgrade to a supported version."`);
  }

  // Add version headers
  res.set('API-Version', versionInfo.version);
  res.set('API-Version-Status', versionInfo.status);
  
  // Store version info in request
  req.apiVersion = version;
  req.apiVersionInfo = versionInfo;
  
  next();
};

// Version info endpoint
const getVersionInfo = (req, res) => {
  const version = req.params.version || DEFAULT_VERSION;
  const versionInfo = API_VERSIONS[version];
  
  if (!versionInfo) {
    return res.status(404).json({
      success: false,
      message: 'API version not found',
      error: {
        code: 'VERSION_NOT_FOUND',
        providedVersion: version,
        supportedVersions: Object.keys(API_VERSIONS)
      }
    });
  }

  res.json({
    success: true,
    data: {
      version: version,
      ...versionInfo,
      supportedVersions: Object.keys(API_VERSIONS),
      defaultVersion: DEFAULT_VERSION
    }
  });
};

// All versions info endpoint
const getAllVersions = (req, res) => {
  res.json({
    success: true,
    data: {
      versions: API_VERSIONS,
      defaultVersion: DEFAULT_VERSION,
      currentVersion: DEFAULT_VERSION
    }
  });
};

// Version deprecation warning middleware
const checkDeprecation = (req, res, next) => {
  const version = req.apiVersion;
  const versionInfo = req.apiVersionInfo;
  
  if (versionInfo.status === 'deprecated') {
    // Log deprecation warning
    console.warn(`[API DEPRECATION] Version ${version} is deprecated. Client: ${req.ip}, Endpoint: ${req.method} ${req.originalUrl}`);
  }
  
  next();
};

// Create versioned router
const createVersionedRouter = (version) => {
  const router = express.Router();
  
  // Add version-specific middleware
  router.use((req, res, next) => {
    req.apiVersion = version;
    req.apiVersionInfo = API_VERSIONS[version];
    next();
  });
  
  return router;
};

// Version-specific error handler
const versionErrorHandler = (err, req, res, next) => {
  const version = req.apiVersion || DEFAULT_VERSION;
  const versionInfo = API_VERSIONS[version];
  
  // Add version info to error response
  if (res.headersSent) {
    return next(err);
  }
  
  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error',
    error: {
      code: err.code || 'INTERNAL_ERROR',
      version: version,
      timestamp: new Date().toISOString()
    }
  };
  
  // Add version headers
  res.set('API-Version', versionInfo.version);
  res.set('API-Version-Status', versionInfo.status);
  
  res.status(err.status || 500).json(errorResponse);
};

module.exports = {
  API_VERSIONS,
  DEFAULT_VERSION,
  validateApiVersion,
  getVersionInfo,
  getAllVersions,
  checkDeprecation,
  createVersionedRouter,
  versionErrorHandler
};