const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  location: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  imageUrl: { type: String },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  price: { type: String },
  isFree: { type: Boolean, default: false },
  url: { type: String },
  category: { type: mongoose.Schema.ObjectId, ref: 'Category' },
  organizer: { type: mongoose.Schema.ObjectId, ref: 'User' },
  capacity: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], 
    default: 'upcoming' 
  },
  tags: [{ type: String }],
  attendees: [{ type: mongoose.Schema.ObjectId, ref: 'User' }],
  
  // Recurring event support
  isRecurring: { type: Boolean, default: false },
  recurringPattern: {
    type: { 
      type: String, 
      enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'],
      default: 'weekly'
    },
    interval: { type: Number, default: 1 }, // Every X days/weeks/months/years
    daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0 = Sunday, 1 = Monday, etc.
    dayOfMonth: { type: Number, min: 1, max: 31 },
    endDate: { type: Date }, // When to stop recurring
    occurrences: { type: Number }, // Maximum number of occurrences
    customRule: { type: String } // For complex recurring patterns
  },
  parentEvent: { type: mongoose.Schema.ObjectId, ref: 'Event' }, // Reference to original recurring event
  recurringGroupId: { type: String }, // Groups all instances of a recurring event
  
  // Event collaboration
  coOrganizers: [{ 
    user: { type: mongoose.Schema.ObjectId, ref: 'User' },
    role: { 
      type: String, 
      enum: ['co-organizer', 'assistant', 'moderator'],
      default: 'co-organizer'
    },
    permissions: [{
      type: String,
      enum: ['edit', 'delete', 'manage_attendees', 'send_emails', 'view_analytics']
    }],
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.ObjectId, ref: 'User' }
  }],
  
  // Event analytics
  analytics: {
    views: { type: Number, default: 0 },
    registrations: { type: Number, default: 0 },
    checkIns: { type: Number, default: 0 },
    lastViewed: { type: Date },
    conversionRate: { type: Number, default: 0 },
    engagementScore: { type: Number, default: 0 }
  },
  
  // Event template reference
  templateId: { type: mongoose.Schema.ObjectId, ref: 'EventTemplate' },
  
  // Export settings
  exportSettings: {
    allowICalExport: { type: Boolean, default: true },
    allowGoogleCalendarExport: { type: Boolean, default: true },
    allowOutlookExport: { type: Boolean, default: true }
  }
});

// Middleware to update `updatedAt` before saving
EventSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
EventSchema.index({ organizer: 1 });
EventSchema.index({ category: 1 });
EventSchema.index({ startDateTime: 1 });
EventSchema.index({ status: 1 });
EventSchema.index({ createdAt: -1 });
EventSchema.index({ title: 'text', description: 'text' }); // Text search index

const Event = mongoose.model('Event', EventSchema);
module.exports = Event;
