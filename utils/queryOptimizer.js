const { cacheService, CacheKeys } = require('../services/cacheService');
const logger = require('../utils/logger');

class QueryOptimizer {
  constructor() {
    this.populationCache = new Map();
  }

  // Optimize event queries with population
  async getEventsWithPopulation(query = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      populate = ['organizer', 'category'],
      sort = { createdAt: -1 },
      cache = true,
      cacheTTL = 300 // 5 minutes
    } = options;

    const Event = require('../models/event');
    const User = require('../models/user');
    const Category = require('../models/category');

    try {
      // Create cache key
      const cacheKey = `events:populated:${JSON.stringify(query)}:${page}:${limit}:${JSON.stringify(sort)}`;
      
      if (cache) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug('Cache hit for events with population');
          return cached;
        }
      }

      // Build aggregation pipeline for optimal performance
      const pipeline = [
        // Match stage
        { $match: query },
        
        // Sort stage
        { $sort: sort },
        
        // Pagination
        { $skip: (page - 1) * limit },
        { $limit: limit },
        
        // Lookup organizer
        {
          $lookup: {
            from: 'users',
            localField: 'organizer',
            foreignField: '_id',
            as: 'organizer',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  username: 1,
                  firstName: 1,
                  lastName: 1,
                  avatar: 1,
                  email: 1
                }
              }
            ]
          }
        },
        
        // Lookup category
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'category',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  description: 1,
                  imageUrl: 1
                }
              }
            ]
          }
        },
        
        // Unwind arrays
        { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        
        // Add computed fields
        {
          $addFields: {
            isUpcoming: {
              $gt: ['$startDateTime', new Date()]
            },
            isLive: {
              $and: [
                { $lte: ['$startDateTime', new Date()] },
                { $gte: ['$endDateTime', new Date()] }
              ]
            },
            duration: {
              $subtract: ['$endDateTime', '$startDateTime']
            }
          }
        }
      ];

      // Execute aggregation
      const [events, totalCount] = await Promise.all([
        Event.aggregate(pipeline),
        Event.countDocuments(query)
      ]);

      const result = {
        events,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };

      // Cache the result
      if (cache) {
        await cacheService.set(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      logger.error('Error in getEventsWithPopulation:', error);
      throw error;
    }
  }

  // Optimize user queries with population
  async getUsersWithPopulation(query = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      populate = ['events'],
      sort = { createdAt: -1 },
      cache = true,
      cacheTTL = 300
    } = options;

    const User = require('../models/user');
    const Event = require('../models/event');

    try {
      const cacheKey = `users:populated:${JSON.stringify(query)}:${page}:${limit}:${JSON.stringify(sort)}`;
      
      if (cache) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const pipeline = [
        { $match: query },
        { $sort: sort },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        
        // Lookup user's events
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: 'organizer',
            as: 'events',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  title: 1,
                  status: 1,
                  startDateTime: 1,
                  endDateTime: 1,
                  location: 1,
                  price: 1
                }
              }
            ]
          }
        },
        
        // Add computed fields
        {
          $addFields: {
            eventsCount: { $size: '$events' },
            upcomingEvents: {
              $size: {
                $filter: {
                  input: '$events',
                  cond: { $gt: ['$$this.startDateTime', new Date()] }
                }
              }
            }
          }
        }
      ];

      const [users, totalCount] = await Promise.all([
        User.aggregate(pipeline),
        User.countDocuments(query)
      ]);

      const result = {
        users,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };

      if (cache) {
        await cacheService.set(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      logger.error('Error in getUsersWithPopulation:', error);
      throw error;
    }
  }

  // Optimize task queries with population
  async getTasksWithPopulation(query = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      populate = ['event', 'assignedTo'],
      sort = { dueDate: 1 },
      cache = true,
      cacheTTL = 300
    } = options;

    const Task = require('../models/task');
    const Event = require('../models/event');
    const User = require('../models/user');

    try {
      const cacheKey = `tasks:populated:${JSON.stringify(query)}:${page}:${limit}:${JSON.stringify(sort)}`;
      
      if (cache) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const pipeline = [
        { $match: query },
        { $sort: sort },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        
        // Lookup event
        {
          $lookup: {
            from: 'events',
            localField: 'eventId',
            foreignField: '_id',
            as: 'event',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  title: 1,
                  startDateTime: 1,
                  endDateTime: 1,
                  location: 1
                }
              }
            ]
          }
        },
        
        // Lookup assigned user
        {
          $lookup: {
            from: 'users',
            localField: 'assignedTo',
            foreignField: '_id',
            as: 'assignedTo',
            pipeline: [
              {
                $project: {
                  _id: 1,
                  username: 1,
                  firstName: 1,
                  lastName: 1,
                  avatar: 1,
                  email: 1
                }
              }
            ]
          }
        },
        
        // Unwind arrays
        { $unwind: { path: '$event', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$assignedTo', preserveNullAndEmptyArrays: true } },
        
        // Add computed fields
        {
          $addFields: {
            isOverdue: {
              $and: [
                { $ne: ['$status', 'completed'] },
                { $lt: ['$dueDate', new Date()] }
              ]
            },
            daysUntilDue: {
              $divide: [
                { $subtract: ['$dueDate', new Date()] },
                86400000 // milliseconds in a day
              ]
            }
          }
        }
      ];

      const [tasks, totalCount] = await Promise.all([
        Task.aggregate(pipeline),
        Task.countDocuments(query)
      ]);

      const result = {
        tasks,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };

      if (cache) {
        await cacheService.set(cacheKey, result, cacheTTL);
      }

      return result;
    } catch (error) {
      logger.error('Error in getTasksWithPopulation:', error);
      throw error;
    }
  }

  // Batch populate function to avoid N+1 queries
  async batchPopulate(items, field, model, select = {}) {
    if (!items || items.length === 0) return items;

    try {
      const ids = items
        .map(item => item[field])
        .filter(id => id)
        .map(id => id.toString ? id.toString() : id);

      if (ids.length === 0) return items;

      // Get all related documents in one query
      const relatedDocs = await model.find(
        { _id: { $in: ids } },
        select
      ).lean();

      // Create a map for quick lookup
      const relatedMap = new Map();
      relatedDocs.forEach(doc => {
        relatedMap.set(doc._id.toString(), doc);
      });

      // Populate the items
      return items.map(item => {
        const relatedId = item[field];
        if (relatedId) {
          const relatedDoc = relatedMap.get(relatedId.toString());
          if (relatedDoc) {
            return {
              ...item,
              [field]: relatedDoc
            };
          }
        }
        return item;
      });
    } catch (error) {
      logger.error('Error in batchPopulate:', error);
      return items;
    }
  }

  // Optimize single document with population
  async populateDocument(document, fields = []) {
    if (!document) return document;

    try {
      const populatedDoc = { ...document.toObject ? document.toObject() : document };
      
      for (const field of fields) {
        const { model, select = {} } = field;
        const id = populatedDoc[field.fieldName];
        
        if (id) {
          const relatedDoc = await model.findById(id, select).lean();
          if (relatedDoc) {
            populatedDoc[field.fieldName] = relatedDoc;
          }
        }
      }
      
      return populatedDoc;
    } catch (error) {
      logger.error('Error in populateDocument:', error);
      return document;
    }
  }

  // Clear population cache
  clearCache() {
    this.populationCache.clear();
  }
}

// Singleton instance
const queryOptimizer = new QueryOptimizer();

module.exports = {
  queryOptimizer,
  QueryOptimizer
};