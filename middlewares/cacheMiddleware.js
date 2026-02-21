const { cacheService, CacheKeys } = require('../services/cacheService');
const logger = require('../utils/logger');

// Cache middleware factory
const createCacheMiddleware = (options = {}) => {
  const {
    ttl = 3600, // 1 hour default
    keyGenerator = null,
    skipCache = false,
    tags = [],
    condition = null
  } = options;

  return async (req, res, next) => {
    // Skip caching if disabled
    if (skipCache || !cacheService.isReady()) {
      return next();
    }

    // Check if caching should be skipped based on condition
    if (condition && !condition(req)) {
      return next();
    }

    try {
      // Generate cache key
      const cacheKey = keyGenerator ? keyGenerator(req) : generateDefaultKey(req);
      
      // Try to get from cache
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        logger.debug(`Cache hit for ${req.method} ${req.originalUrl}`);
        return res.json(cachedResponse);
      }

      // Store original res.json to intercept response
      const originalJson = res.json;
      res.json = function(data) {
        // Store in cache if response is successful
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cacheData = {
            data: data,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString()
          };

          if (tags.length > 0) {
            cacheService.setWithTags(cacheKey, cacheData, tags, ttl);
          } else {
            cacheService.set(cacheKey, cacheData, ttl);
          }
        }

        // Call original res.json
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

// Default cache key generator
const generateDefaultKey = (req) => {
  const { method, originalUrl, query, body } = req;
  const userId = req.user?.id || req.auth?.userId || 'anonymous';
  
  // Create a unique key based on method, URL, query params, and user
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  const bodyString = method !== 'GET' && body ? JSON.stringify(body) : '';
  
  return `api:${method}:${originalUrl}:${queryString}:${bodyString}:${userId}`;
};

// Specific cache key generators
const cacheKeyGenerators = {
  // User-related endpoints
  getUser: (req) => CacheKeys.user(req.params.id),
  getUserByEmail: (req) => CacheKeys.userByEmail(req.body.email),
  
  // Event-related endpoints
  getEvent: (req) => CacheKeys.event(req.params.id),
  getEvents: (req) => {
    const { category, status, page = 1, limit = 10 } = req.query;
    if (category) return CacheKeys.eventsByCategory(category, page, limit);
    if (status) return CacheKeys.eventsByStatus(status, page, limit);
    return `events:all:${page}:${limit}`;
  },
  getEventsByOrganizer: (req) => {
    const { page = 1, limit = 10 } = req.query;
    return CacheKeys.eventsByOrganizer(req.params.organizerId, page, limit);
  },
  searchEvents: (req) => {
    const { q, page = 1, limit = 10 } = req.query;
    return CacheKeys.eventsSearch(q, page, limit);
  },
  
  // Category endpoints
  getCategories: () => CacheKeys.categories(),
  getCategory: (req) => CacheKeys.category(req.params.id),
  
  // Task endpoints
  getTasksByEvent: (req) => CacheKeys.tasksByEvent(req.params.eventId),
  getTasksByUser: (req) => CacheKeys.tasksByUser(req.params.userId)
};

// Cache invalidation middleware
const createInvalidationMiddleware = (tags = []) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    res.json = function(data) {
      // Invalidate cache if response is successful
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheService.invalidateByTags(tags).catch(error => {
          logger.error('Cache invalidation error:', error);
        });
      }

      // Call original res.json
      return originalJson.call(this, data);
    };

    next();
  };
};

// Cache warming middleware
const warmCache = async (req, res, next) => {
  try {
    // Warm up frequently accessed data
    if (req.originalUrl === '/api/events' && req.method === 'GET') {
      // Pre-warm events cache
      const { category, status, page = 1, limit = 10 } = req.query;
      const cacheKey = cacheKeyGenerators.getEvents(req);
      
      // Check if cache exists, if not, let the request proceed normally
      const cached = await cacheService.get(cacheKey);
      if (!cached) {
        logger.debug(`Cache warming for ${cacheKey}`);
      }
    }
  } catch (error) {
    logger.error('Cache warming error:', error);
  }
  
  next();
};

// Cache statistics endpoint
const getCacheStats = async (req, res) => {
  try {
    const stats = await cacheService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cache statistics'
    });
  }
};

// Clear cache endpoint
const clearCache = async (req, res) => {
  try {
    const { pattern = '*' } = req.query;
    
    if (pattern === '*') {
      // Clear all cache
      await cacheService.delPattern('*');
    } else {
      // Clear specific pattern
      await cacheService.delPattern(pattern);
    }
    
    res.json({
      success: true,
      message: `Cache cleared for pattern: ${pattern}`
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing cache'
    });
  }
};

module.exports = {
  createCacheMiddleware,
  createInvalidationMiddleware,
  warmCache,
  getCacheStats,
  clearCache,
  cacheKeyGenerators
};