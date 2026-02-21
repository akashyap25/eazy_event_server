const { cacheService } = require('../services/cacheService');
const logger = require('../utils/logger');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      },
      database: {
        queries: 0,
        averageQueryTime: 0,
        slowQueries: 0
      },
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      memory: {
        used: 0,
        free: 0,
        total: 0
      }
    };
    
    this.responseTimes = [];
    this.queryTimes = [];
    this.slowQueryThreshold = 1000; // 1 second
  }

  // Record request metrics
  recordRequest(responseTime, success = true) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift(); // Keep only last 1000
    }

    // Calculate average response time
    this.metrics.requests.averageResponseTime = 
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  // Record database query metrics
  recordQuery(queryTime, query = '') {
    this.metrics.database.queries++;
    
    this.queryTimes.push(queryTime);
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }

    this.metrics.database.averageQueryTime = 
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;

    // Track slow queries
    if (queryTime > this.slowQueryThreshold) {
      this.metrics.database.slowQueries++;
      logger.warn(`Slow query detected: ${queryTime}ms - ${query}`);
    }
  }

  // Record cache metrics
  recordCacheHit() {
    this.metrics.cache.hits++;
    this.updateCacheHitRate();
  }

  recordCacheMiss() {
    this.metrics.cache.misses++;
    this.updateCacheHitRate();
  }

  updateCacheHitRate() {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
  }

  // Update memory metrics
  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory.used = memUsage.heapUsed;
    this.metrics.memory.free = memUsage.heapTotal - memUsage.heapUsed;
    this.metrics.memory.total = memUsage.heapTotal;
  }

  // Get current metrics
  getMetrics() {
    this.updateMemoryMetrics();
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  // Get performance report
  getPerformanceReport() {
    const metrics = this.getMetrics();
    
    return {
      summary: {
        totalRequests: metrics.requests.total,
        successRate: metrics.requests.total > 0 ? 
          (metrics.requests.successful / metrics.requests.total) * 100 : 0,
        averageResponseTime: Math.round(metrics.requests.averageResponseTime),
        cacheHitRate: Math.round(metrics.cache.hitRate * 100) / 100,
        memoryUsage: Math.round((metrics.memory.used / metrics.memory.total) * 100 * 100) / 100
      },
      details: metrics,
      recommendations: this.getRecommendations(metrics)
    };
  }

  // Get performance recommendations
  getRecommendations(metrics) {
    const recommendations = [];

    // Response time recommendations
    if (metrics.requests.averageResponseTime > 500) {
      recommendations.push({
        type: 'warning',
        category: 'response_time',
        message: 'Average response time is high. Consider optimizing queries or adding caching.',
        value: `${Math.round(metrics.requests.averageResponseTime)}ms`
      });
    }

    // Cache recommendations
    if (metrics.cache.hitRate < 50) {
      recommendations.push({
        type: 'info',
        category: 'caching',
        message: 'Cache hit rate is low. Consider reviewing cache strategy.',
        value: `${Math.round(metrics.cache.hitRate * 100) / 100}%`
      });
    }

    // Memory recommendations
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push({
        type: 'warning',
        category: 'memory',
        message: 'High memory usage detected. Consider optimizing memory usage.',
        value: `${Math.round(memoryUsagePercent * 100) / 100}%`
      });
    }

    // Database recommendations
    if (metrics.database.slowQueries > 10) {
      recommendations.push({
        type: 'warning',
        category: 'database',
        message: 'Multiple slow queries detected. Consider adding indexes or optimizing queries.',
        value: `${metrics.database.slowQueries} slow queries`
      });
    }

    return recommendations;
  }

  // Reset metrics
  reset() {
    this.metrics = {
      requests: { total: 0, successful: 0, failed: 0, averageResponseTime: 0 },
      database: { queries: 0, averageQueryTime: 0, slowQueries: 0 },
      cache: { hits: 0, misses: 0, hitRate: 0 },
      memory: { used: 0, free: 0, total: 0 }
    };
    this.responseTimes = [];
    this.queryTimes = [];
  }

  // Export metrics to external monitoring service
  async exportMetrics() {
    try {
      const metrics = this.getMetrics();
      
      // Store in cache for external access
      await cacheService.set('performance:metrics', metrics, 60); // 1 minute TTL
      
      // Log metrics periodically
      logger.info('Performance metrics updated', {
        requests: metrics.requests.total,
        avgResponseTime: Math.round(metrics.requests.averageResponseTime),
        cacheHitRate: Math.round(metrics.cache.hitRate * 100) / 100,
        memoryUsage: Math.round((metrics.memory.used / metrics.memory.total) * 100 * 100) / 100
      });
    } catch (error) {
      logger.error('Error exporting metrics:', error);
    }
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

// Performance middleware
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Override res.json to capture response time
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 300;
    
    performanceMonitor.recordRequest(responseTime, success);
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Database query monitoring
const monitorQuery = (query, queryTime) => {
  performanceMonitor.recordQuery(queryTime, query);
};

// Cache monitoring
const monitorCache = {
  hit: () => performanceMonitor.recordCacheHit(),
  miss: () => performanceMonitor.recordCacheMiss()
};

module.exports = {
  performanceMonitor,
  performanceMiddleware,
  monitorQuery,
  monitorCache
};