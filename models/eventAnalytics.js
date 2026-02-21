const mongoose = require('mongoose');

const EventAnalyticsSchema = new mongoose.Schema({
  eventId: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Event',
    required: true
  },
  
  // View analytics
  views: {
    total: { type: Number, default: 0 },
    unique: { type: Number, default: 0 },
    bySource: {
      direct: { type: Number, default: 0 },
      search: { type: Number, default: 0 },
      social: { type: Number, default: 0 },
      email: { type: Number, default: 0 },
      referral: { type: Number, default: 0 }
    },
    byDevice: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 }
    },
    byLocation: {
      country: { type: String },
      city: { type: String },
      region: { type: String }
    }
  },
  
  // Registration analytics
  registrations: {
    total: { type: Number, default: 0 },
    byDate: [{
      date: { type: Date },
      count: { type: Number, default: 0 }
    }],
    conversionRate: { type: Number, default: 0 },
    dropOffRate: { type: Number, default: 0 }
  },
  
  // Attendance analytics
  attendance: {
    total: { type: Number, default: 0 },
    checkIns: { type: Number, default: 0 },
    noShows: { type: Number, default: 0 },
    attendanceRate: { type: Number, default: 0 },
    byTimeSlot: [{
      timeSlot: { type: String },
      count: { type: Number, default: 0 }
    }]
  },
  
  // Engagement analytics
  engagement: {
    likes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    bookmarks: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 }
  },
  
  // Revenue analytics (if applicable)
  revenue: {
    total: { type: Number, default: 0 },
    byTicketType: [{
      ticketType: { type: String },
      price: { type: Number },
      quantity: { type: Number },
      revenue: { type: Number }
    }],
    averageOrderValue: { type: Number, default: 0 }
  },
  
  // Social media analytics
  socialMedia: {
    facebook: {
      shares: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 }
    },
    twitter: {
      retweets: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      mentions: { type: Number, default: 0 }
    },
    linkedin: {
      shares: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 }
    }
  },
  
  // Email marketing analytics
  emailMarketing: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 }
  },
  
  // Performance metrics
  performance: {
    pageLoadTime: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    sessionDuration: { type: Number, default: 0 },
    pagesPerSession: { type: Number, default: 0 }
  },
  
  // Timestamps
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
EventAnalyticsSchema.index({ eventId: 1 });
EventAnalyticsSchema.index({ lastUpdated: -1 });
EventAnalyticsSchema.index({ 'views.total': -1 });
EventAnalyticsSchema.index({ 'registrations.total': -1 });
EventAnalyticsSchema.index({ 'engagement.engagementScore': -1 });

// Method to update view count
EventAnalyticsSchema.methods.incrementViews = function(source = 'direct', device = 'desktop') {
  this.views.total += 1;
  this.views.bySource[source] = (this.views.bySource[source] || 0) + 1;
  this.views.byDevice[device] = (this.views.byDevice[device] || 0) + 1;
  this.lastUpdated = new Date();
  return this.save();
};

// Method to update registration count
EventAnalyticsSchema.methods.incrementRegistrations = function() {
  this.registrations.total += 1;
  this.registrations.conversionRate = (this.registrations.total / this.views.total) * 100;
  this.lastUpdated = new Date();
  return this.save();
};

// Method to update attendance
EventAnalyticsSchema.methods.updateAttendance = function(checkIns, noShows) {
  this.attendance.checkIns = checkIns;
  this.attendance.noShows = noShows;
  this.attendance.total = checkIns + noShows;
  this.attendance.attendanceRate = (checkIns / this.registrations.total) * 100;
  this.lastUpdated = new Date();
  return this.save();
};

// Method to calculate engagement score
EventAnalyticsSchema.methods.calculateEngagementScore = function() {
  const { likes, shares, comments, bookmarks } = this.engagement;
  this.engagement.engagementScore = (likes * 1) + (shares * 3) + (comments * 2) + (bookmarks * 1);
  this.lastUpdated = new Date();
  return this.save();
};

const EventAnalytics = mongoose.model('EventAnalytics', EventAnalyticsSchema);
module.exports = EventAnalytics;