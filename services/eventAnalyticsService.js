const EventAnalytics = require('../models/eventAnalytics');
const Event = require('../models/event');

class EventAnalyticsService {
  /**
   * Track event view
   * @param {String} eventId - Event ID
   * @param {Object} viewData - View tracking data
   * @returns {Promise<Object>} Analytics update result
   */
  static async trackView(eventId, viewData = {}) {
    try {
      const { source = 'direct', device = 'desktop', location = {} } = viewData;
      
      let analytics = await EventAnalytics.findOne({ eventId });
      
      if (!analytics) {
        analytics = new EventAnalytics({ eventId });
      }
      
      await analytics.incrementViews(source, device);
      
      // Update location data if provided
      if (location.country) {
        analytics.views.byLocation.country = location.country;
      }
      if (location.city) {
        analytics.views.byLocation.city = location.city;
      }
      if (location.region) {
        analytics.views.byLocation.region = location.region;
      }
      
      analytics.lastViewed = new Date();
      await analytics.save();
      
      return { success: true, analytics };
    } catch (error) {
      throw new Error(`Failed to track view: ${error.message}`);
    }
  }
  
  /**
   * Track event registration
   * @param {String} eventId - Event ID
   * @returns {Promise<Object>} Analytics update result
   */
  static async trackRegistration(eventId) {
    try {
      let analytics = await EventAnalytics.findOne({ eventId });
      
      if (!analytics) {
        analytics = new EventAnalytics({ eventId });
      }
      
      await analytics.incrementRegistrations();
      
      // Add registration by date
      const today = new Date().toISOString().split('T')[0];
      const existingDateEntry = analytics.registrations.byDate.find(entry => 
        entry.date.toISOString().split('T')[0] === today
      );
      
      if (existingDateEntry) {
        existingDateEntry.count += 1;
      } else {
        analytics.registrations.byDate.push({
          date: new Date(today),
          count: 1
        });
      }
      
      await analytics.save();
      
      return { success: true, analytics };
    } catch (error) {
      throw new Error(`Failed to track registration: ${error.message}`);
    }
  }
  
  /**
   * Track event check-in
   * @param {String} eventId - Event ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Analytics update result
   */
  static async trackCheckIn(eventId, userId) {
    try {
      let analytics = await EventAnalytics.findOne({ eventId });
      
      if (!analytics) {
        analytics = new EventAnalytics({ eventId });
      }
      
      analytics.attendance.checkIns += 1;
      analytics.attendance.total = analytics.attendance.checkIns + analytics.attendance.noShows;
      analytics.attendance.attendanceRate = (analytics.attendance.checkIns / analytics.registrations.total) * 100;
      
      await analytics.save();
      
      return { success: true, analytics };
    } catch (error) {
      throw new Error(`Failed to track check-in: ${error.message}`);
    }
  }
  
  /**
   * Track engagement (likes, shares, comments, bookmarks)
   * @param {String} eventId - Event ID
   * @param {String} action - Engagement action
   * @param {Number} count - Count to add (default: 1)
   * @returns {Promise<Object>} Analytics update result
   */
  static async trackEngagement(eventId, action, count = 1) {
    try {
      let analytics = await EventAnalytics.findOne({ eventId });
      
      if (!analytics) {
        analytics = new EventAnalytics({ eventId });
      }
      
      if (analytics.engagement[action] !== undefined) {
        analytics.engagement[action] += count;
        await analytics.calculateEngagementScore();
      }
      
      return { success: true, analytics };
    } catch (error) {
      throw new Error(`Failed to track engagement: ${error.message}`);
    }
  }
  
  /**
   * Get event analytics
   * @param {String} eventId - Event ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Event analytics data
   */
  static async getEventAnalytics(eventId, options = {}) {
    try {
      let analytics = await EventAnalytics.findOne({ eventId });
      
      if (!analytics) {
        analytics = new EventAnalytics({ eventId });
        await analytics.save();
      }
      
      // Get event details
      const event = await Event.findById(eventId)
        .populate('category', 'name')
        .populate('organizer', 'username firstName lastName');
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Calculate additional metrics
      const metrics = {
        ...analytics.toObject(),
        event: {
          title: event.title,
          category: event.category?.name,
          organizer: event.organizer?.username,
          startDateTime: event.startDateTime,
          endDateTime: event.endDateTime
        },
        calculated: {
          conversionRate: analytics.registrations.conversionRate,
          attendanceRate: analytics.attendance.attendanceRate,
          engagementScore: analytics.engagement.engagementScore,
          averageOrderValue: analytics.revenue.averageOrderValue
        }
      };
      
      return { success: true, analytics: metrics };
    } catch (error) {
      throw new Error(`Failed to get event analytics: ${error.message}`);
    }
  }
  
  /**
   * Get analytics dashboard data
   * @param {String} organizerId - Organizer ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Dashboard analytics data
   */
  static async getDashboardAnalytics(organizerId, options = {}) {
    try {
      const { startDate, endDate, limit = 10 } = options;
      
      // Get organizer's events
      const eventQuery = { organizer: organizerId };
      if (startDate) {
        eventQuery.startDateTime = { $gte: new Date(startDate) };
      }
      if (endDate) {
        eventQuery.startDateTime = { 
          ...eventQuery.startDateTime,
          $lte: new Date(endDate)
        };
      }
      
      const events = await Event.find(eventQuery)
        .populate('category', 'name')
        .sort({ startDateTime: -1 })
        .limit(limit);
      
      const eventIds = events.map(event => event._id);
      
      // Get analytics for all events
      const analytics = await EventAnalytics.find({ eventId: { $in: eventIds } });
      
      // Calculate aggregate metrics
      const aggregateMetrics = {
        totalEvents: events.length,
        totalViews: analytics.reduce((sum, a) => sum + a.views.total, 0),
        totalRegistrations: analytics.reduce((sum, a) => sum + a.registrations.total, 0),
        totalAttendance: analytics.reduce((sum, a) => sum + a.attendance.total, 0),
        totalRevenue: analytics.reduce((sum, a) => sum + a.revenue.total, 0),
        averageConversionRate: analytics.length > 0 ? 
          analytics.reduce((sum, a) => sum + a.registrations.conversionRate, 0) / analytics.length : 0,
        averageAttendanceRate: analytics.length > 0 ? 
          analytics.reduce((sum, a) => sum + a.attendance.attendanceRate, 0) / analytics.length : 0
      };
      
      // Get top performing events
      const topEvents = events.map(event => {
        const eventAnalytics = analytics.find(a => a.eventId.toString() === event._id.toString());
        return {
          event: {
            id: event._id,
            title: event.title,
            category: event.category?.name,
            startDateTime: event.startDateTime
          },
          metrics: eventAnalytics ? {
            views: eventAnalytics.views.total,
            registrations: eventAnalytics.registrations.total,
            attendance: eventAnalytics.attendance.total,
            conversionRate: eventAnalytics.registrations.conversionRate,
            engagementScore: eventAnalytics.engagement.engagementScore
          } : {
            views: 0,
            registrations: 0,
            attendance: 0,
            conversionRate: 0,
            engagementScore: 0
          }
        };
      }).sort((a, b) => b.metrics.engagementScore - a.metrics.engagementScore);
      
      return {
        success: true,
        data: {
          aggregateMetrics,
          topEvents,
          events: events.map(event => ({
            id: event._id,
            title: event.title,
            category: event.category?.name,
            startDateTime: event.startDateTime,
            status: event.status
          }))
        }
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard analytics: ${error.message}`);
    }
  }
  
  /**
   * Generate analytics report
   * @param {String} eventId - Event ID
   * @param {String} format - Report format (json, csv, pdf)
   * @returns {Promise<Object>} Analytics report
   */
  static async generateReport(eventId, format = 'json') {
    try {
      const analytics = await this.getEventAnalytics(eventId);
      
      if (format === 'json') {
        return {
          success: true,
          format: 'json',
          data: analytics.analytics
        };
      }
      
      // For CSV and PDF formats, you would implement specific formatters
      // This is a placeholder for future implementation
      return {
        success: true,
        format,
        message: `${format.toUpperCase()} report generation not yet implemented`
      };
    } catch (error) {
      throw new Error(`Failed to generate report: ${error.message}`);
    }
  }
}

module.exports = EventAnalyticsService;