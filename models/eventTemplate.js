const mongoose = require('mongoose');

const EventTemplateSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  category: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'Category',
    required: true
  },
  
  // Template configuration
  templateData: {
    title: { type: String, required: true },
    description: { type: String },
    location: { type: String },
    imageUrl: { type: String },
    price: { type: String, default: '0' },
    isFree: { type: Boolean, default: true },
    capacity: { type: Number, default: 50 },
    isOnline: { type: Boolean, default: false },
    tags: [{ type: String }],
    duration: { type: Number, default: 120 }, // Duration in minutes
    
    // Recurring settings
    isRecurring: { type: Boolean, default: false },
    recurringPattern: {
      type: { 
        type: String, 
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        default: 'weekly'
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
      occurrences: { type: Number, default: 10 }
    },
    
    // Collaboration settings
    coOrganizers: [{
      role: { 
        type: String, 
        enum: ['co-organizer', 'assistant', 'moderator'],
        default: 'co-organizer'
      },
      permissions: [{
        type: String,
        enum: ['edit', 'delete', 'manage_attendees', 'send_emails', 'view_analytics']
      }]
    }],
    
    // Export settings
    exportSettings: {
      allowICalExport: { type: Boolean, default: true },
      allowGoogleCalendarExport: { type: Boolean, default: true },
      allowOutlookExport: { type: Boolean, default: true }
    }
  },
  
  // Template metadata
  isPublic: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },
  usageCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  tags: [{ type: String }],
  
  // Template creator
  createdBy: { 
    type: mongoose.Schema.ObjectId, 
    ref: 'User',
    required: false // Optional for public templates
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware to update `updatedAt` before saving
EventTemplateSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
EventTemplateSchema.index({ category: 1 });
EventTemplateSchema.index({ isPublic: 1, isActive: 1 });
EventTemplateSchema.index({ createdBy: 1 });
EventTemplateSchema.index({ usageCount: -1 });
EventTemplateSchema.index({ rating: -1 });
EventTemplateSchema.index({ name: 'text', description: 'text' });

// Virtual for template popularity score
EventTemplateSchema.virtual('popularityScore').get(function() {
  return (this.usageCount * 0.7) + (this.rating * 0.3);
});

// Method to increment usage count
EventTemplateSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

// Method to update rating
EventTemplateSchema.methods.updateRating = function(newRating) {
  this.rating = newRating;
  return this.save();
};

const EventTemplate = mongoose.model('EventTemplate', EventTemplateSchema);
module.exports = EventTemplate;