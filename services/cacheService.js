const Redis = require('ioredis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.defaultTTL = 3600; // 1 hour default TTL
  }

  // Initialize Redis connection
  async connect() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Connection pool settings
        family: 4,
        keepAlive: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        // Retry settings
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        // Performance settings
        enableReadyCheck: true,
        maxLoadingTimeout: 10000
      };

      this.redis = new Redis(redisConfig);

      // Event handlers
      this.redis.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        logger.warn('Redis client connection closed');
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        logger.info('Redis client reconnecting...');
      });

      // Connect to Redis
      await this.redis.connect();
      
      logger.info('Redis cache service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis cache service:', error);
      this.isConnected = false;
    }
  }

  // Check if Redis is connected
  isReady() {
    return this.isConnected && this.redis && this.redis.status === 'ready';
  }

  // Set cache with TTL
  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping cache set');
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, ttl, serializedValue);
      logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
      return false;
    }
  }

  // Get cache value
  async get(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping cache get');
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value) {
        logger.debug(`Cache hit: ${key}`);
        return JSON.parse(value);
      }
      logger.debug(`Cache miss: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  }

  // Delete cache
  async del(key) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping cache delete');
      return false;
    }

    try {
      const result = await this.redis.del(key);
      logger.debug(`Cache deleted: ${key}`);
      return result > 0;
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}:`, error);
      return false;
    }
  }

  // Delete multiple keys
  async delPattern(pattern) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, skipping cache pattern delete');
      return false;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug(`Cache pattern deleted: ${pattern} (${keys.length} keys)`);
      }
      return true;
    } catch (error) {
      logger.error(`Error deleting cache pattern ${pattern}:`, error);
      return false;
    }
  }

  // Set cache with custom TTL
  async setex(key, value, ttl) {
    return await this.set(key, value, ttl);
  }

  // Get or set cache (cache-aside pattern)
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      let value = await this.get(key);
      
      if (value !== null) {
        return value;
      }

      // If not in cache, fetch from source
      value = await fetchFunction();
      
      if (value !== null && value !== undefined) {
        // Store in cache for next time
        await this.set(key, value, ttl);
      }

      return value;
    } catch (error) {
      logger.error(`Error in getOrSet for key ${key}:`, error);
      // If cache fails, try to fetch from source
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.error(`Error fetching data for key ${key}:`, fetchError);
        throw fetchError;
      }
    }
  }

  // Increment counter
  async incr(key, ttl = this.defaultTTL) {
    if (!this.isReady()) {
      return 0;
    }

    try {
      const result = await this.redis.incr(key);
      // Set TTL if this is a new key
      if (result === 1) {
        await this.redis.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error(`Error incrementing counter for key ${key}:`, error);
      return 0;
    }
  }

  // Set hash field
  async hset(key, field, value, ttl = this.defaultTTL) {
    if (!this.isReady()) {
      return false;
    }

    try {
      await this.redis.hset(key, field, JSON.stringify(value));
      await this.redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Error setting hash field ${field} for key ${key}:`, error);
      return false;
    }
  }

  // Get hash field
  async hget(key, field) {
    if (!this.isReady()) {
      return null;
    }

    try {
      const value = await this.redis.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Error getting hash field ${field} for key ${key}:`, error);
      return null;
    }
  }

  // Get all hash fields
  async hgetall(key) {
    if (!this.isReady()) {
      return {};
    }

    try {
      const hash = await this.redis.hgetall(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value);
      }
      return result;
    } catch (error) {
      logger.error(`Error getting all hash fields for key ${key}:`, error);
      return {};
    }
  }

  // Set with tags for easy invalidation
  async setWithTags(key, value, tags = [], ttl = this.defaultTTL) {
    const success = await this.set(key, value, ttl);
    
    if (success && tags.length > 0) {
      // Store tags for this key
      await this.redis.sadd(`tags:${key}`, ...tags);
      await this.redis.expire(`tags:${key}`, ttl);
      
      // Store key under each tag
      for (const tag of tags) {
        await this.redis.sadd(`tag:${tag}`, key);
        await this.redis.expire(`tag:${tag}`, ttl);
      }
    }
    
    return success;
  }

  // Invalidate by tags
  async invalidateByTags(tags) {
    if (!this.isReady()) {
      return false;
    }

    try {
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`tag:${tag}`);
        }
      }
      logger.debug(`Cache invalidated by tags: ${tags.join(', ')}`);
      return true;
    } catch (error) {
      logger.error(`Error invalidating cache by tags ${tags}:`, error);
      return false;
    }
  }

  // Get cache statistics
  async getStats() {
    if (!this.isReady()) {
      return null;
    }

    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        connected: this.isConnected,
        status: this.redis.status,
        memory: info,
        keyspace: keyspace
      };
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return null;
    }
  }

  // Close Redis connection
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      logger.info('Redis cache service disconnected');
    }
  }
}

// Singleton instance
const cacheService = new CacheService();

// Cache key generators
const CacheKeys = {
  // User cache keys
  user: (id) => `user:${id}`,
  userByEmail: (email) => `user:email:${email}`,
  userByUsername: (username) => `user:username:${username}`,
  
  // Event cache keys
  event: (id) => `event:${id}`,
  eventsByCategory: (category, page = 1, limit = 10) => `events:category:${category}:${page}:${limit}`,
  eventsByOrganizer: (organizerId, page = 1, limit = 10) => `events:organizer:${organizerId}:${page}:${limit}`,
  eventsByStatus: (status, page = 1, limit = 10) => `events:status:${status}:${page}:${limit}`,
  eventsSearch: (query, page = 1, limit = 10) => `events:search:${query}:${page}:${limit}`,
  eventsUpcoming: (page = 1, limit = 10) => `events:upcoming:${page}:${limit}`,
  
  // Category cache keys
  categories: () => 'categories:all',
  category: (id) => `category:${id}`,
  
  // Task cache keys
  tasksByEvent: (eventId) => `tasks:event:${eventId}`,
  tasksByUser: (userId) => `tasks:user:${userId}`,
  
  // General cache keys
  apiResponse: (endpoint, params = '') => `api:${endpoint}:${params}`,
  rateLimit: (identifier) => `rate:${identifier}`
};

module.exports = {
  cacheService,
  CacheKeys
};