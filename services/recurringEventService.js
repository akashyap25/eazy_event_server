const Event = require('../models/event');
const { v4: uuidv4 } = require('uuid');

class RecurringEventService {
  /**
   * Generate recurring event instances based on pattern
   * @param {Object} eventData - Original event data
   * @param {Object} recurringPattern - Recurring pattern configuration
   * @returns {Array} Array of generated event instances
   */
  static generateRecurringInstances(eventData, recurringPattern) {
    const instances = [];
    const { type, interval, daysOfWeek, dayOfMonth, endDate, occurrences } = recurringPattern;
    const startDate = new Date(eventData.startDateTime);
    const endDateTime = new Date(eventData.endDateTime);
    const duration = endDateTime.getTime() - startDate.getTime();
    
    let currentDate = new Date(startDate);
    let count = 0;
    const maxOccurrences = occurrences || 100; // Default to 100 if not specified
    const recurringGroupId = uuidv4();
    
    while (count < maxOccurrences) {
      // Check if we've reached the end date
      if (endDate && currentDate > new Date(endDate)) {
        break;
      }
      
      // Generate the next occurrence date
      const nextDate = this.getNextOccurrenceDate(currentDate, type, interval, daysOfWeek, dayOfMonth);
      
      if (!nextDate) {
        break;
      }
      
      // Create event instance
      const instanceData = {
        ...eventData,
        _id: undefined, // Let MongoDB generate new ID
        startDateTime: nextDate,
        endDateTime: new Date(nextDate.getTime() + duration),
        isRecurring: true,
        recurringPattern,
        parentEvent: eventData._id,
        recurringGroupId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      instances.push(instanceData);
      currentDate = nextDate;
      count++;
    }
    
    return instances;
  }
  
  /**
   * Get the next occurrence date based on pattern
   * @param {Date} currentDate - Current date
   * @param {String} type - Recurring type (daily, weekly, monthly, yearly)
   * @param {Number} interval - Interval between occurrences
   * @param {Array} daysOfWeek - Days of week for weekly pattern
   * @param {Number} dayOfMonth - Day of month for monthly pattern
   * @returns {Date|null} Next occurrence date or null if no more occurrences
   */
  static getNextOccurrenceDate(currentDate, type, interval, daysOfWeek, dayOfMonth) {
    const nextDate = new Date(currentDate);
    
    switch (type) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + interval);
        break;
        
      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          // Find next occurrence of specified days
          let found = false;
          for (let i = 0; i < 7; i++) {
            nextDate.setDate(nextDate.getDate() + 1);
            if (daysOfWeek.includes(nextDate.getDay())) {
              found = true;
              break;
            }
          }
          if (!found) {
            return null;
          }
        } else {
          nextDate.setDate(nextDate.getDate() + (7 * interval));
        }
        break;
        
      case 'monthly':
        if (dayOfMonth) {
          nextDate.setMonth(nextDate.getMonth() + interval);
          nextDate.setDate(dayOfMonth);
        } else {
          nextDate.setMonth(nextDate.getMonth() + interval);
        }
        break;
        
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + interval);
        break;
        
      default:
        return null;
    }
    
    return nextDate;
  }
  
  /**
   * Create recurring events
   * @param {Object} eventData - Original event data
   * @param {Object} recurringPattern - Recurring pattern
   * @returns {Promise<Object>} Created events result
   */
  static async createRecurringEvents(eventData, recurringPattern) {
    try {
      // First, create the parent event
      const parentEvent = await Event.create({
        ...eventData,
        isRecurring: true,
        recurringPattern,
        recurringGroupId: uuidv4()
      });
      
      // Generate recurring instances
      const instances = this.generateRecurringInstances(eventData, recurringPattern);
      
      // Create all instances
      const createdInstances = await Event.insertMany(instances);
      
      return {
        parentEvent,
        instances: createdInstances,
        totalCreated: createdInstances.length + 1
      };
    } catch (error) {
      throw new Error(`Failed to create recurring events: ${error.message}`);
    }
  }
  
  /**
   * Update recurring events
   * @param {String} recurringGroupId - Group ID of recurring events
   * @param {Object} updateData - Data to update
   * @param {String} scope - 'this' (current only), 'following' (current and future), 'all' (all instances)
   * @returns {Promise<Object>} Update result
   */
  static async updateRecurringEvents(recurringGroupId, updateData, scope = 'this') {
    try {
      const query = { recurringGroupId };
      
      // Apply scope filter
      if (scope === 'following') {
        const currentEvent = await Event.findOne({ recurringGroupId, _id: updateData.eventId });
        if (currentEvent) {
          query.startDateTime = { $gte: currentEvent.startDateTime };
        }
      } else if (scope === 'this') {
        query._id = updateData.eventId;
      }
      
      // Remove fields that shouldn't be updated
      const { eventId, ...updateFields } = updateData;
      
      const result = await Event.updateMany(query, updateFields);
      
      return {
        success: true,
        modifiedCount: result.modifiedCount,
        scope
      };
    } catch (error) {
      throw new Error(`Failed to update recurring events: ${error.message}`);
    }
  }
  
  /**
   * Delete recurring events
   * @param {String} recurringGroupId - Group ID of recurring events
   * @param {String} scope - 'this' (current only), 'following' (current and future), 'all' (all instances)
   * @returns {Promise<Object>} Delete result
   */
  static async deleteRecurringEvents(recurringGroupId, scope = 'this', eventId = null) {
    try {
      const query = { recurringGroupId };
      
      // Apply scope filter
      if (scope === 'following') {
        const currentEvent = await Event.findOne({ recurringGroupId, _id: eventId });
        if (currentEvent) {
          query.startDateTime = { $gte: currentEvent.startDateTime };
        }
      } else if (scope === 'this') {
        query._id = eventId;
      }
      
      const result = await Event.deleteMany(query);
      
      return {
        success: true,
        deletedCount: result.deletedCount,
        scope
      };
    } catch (error) {
      throw new Error(`Failed to delete recurring events: ${error.message}`);
    }
  }
  
  /**
   * Get recurring event instances
   * @param {String} recurringGroupId - Group ID of recurring events
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of event instances
   */
  static async getRecurringInstances(recurringGroupId, options = {}) {
    try {
      const query = { recurringGroupId };
      
      // Apply date filters
      if (options.startDate) {
        query.startDateTime = { $gte: new Date(options.startDate) };
      }
      if (options.endDate) {
        query.startDateTime = { 
          ...query.startDateTime,
          $lte: new Date(options.endDate)
        };
      }
      
      const events = await Event.find(query)
        .populate('category', 'name description imageUrl')
        .populate('organizer', 'username firstName lastName avatar email')
        .sort({ startDateTime: 1 });
      
      return events;
    } catch (error) {
      throw new Error(`Failed to get recurring instances: ${error.message}`);
    }
  }
  
  /**
   * Validate recurring pattern
   * @param {Object} pattern - Recurring pattern to validate
   * @returns {Object} Validation result
   */
  static validateRecurringPattern(pattern) {
    const errors = [];
    
    if (!pattern.type) {
      errors.push('Recurring type is required');
    }
    
    if (!pattern.interval || pattern.interval < 1) {
      errors.push('Interval must be at least 1');
    }
    
    if (pattern.type === 'weekly' && (!pattern.daysOfWeek || pattern.daysOfWeek.length === 0)) {
      errors.push('Days of week must be specified for weekly recurring events');
    }
    
    if (pattern.type === 'monthly' && (!pattern.dayOfMonth || pattern.dayOfMonth < 1 || pattern.dayOfMonth > 31)) {
      errors.push('Valid day of month must be specified for monthly recurring events');
    }
    
    if (pattern.endDate && pattern.occurrences) {
      errors.push('Cannot specify both end date and occurrences');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = RecurringEventService;