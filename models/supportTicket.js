const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 5000
  },
  category: {
    type: String,
    enum: ['technical', 'billing', 'feature', 'bug', 'account', 'event', 'payment', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_response', 'resolved', 'closed'],
    default: 'open'
  },
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000
    },
    attachments: [{
      filename: String,
      url: String,
      type: String
    }],
    isStaffReply: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  relatedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  relatedOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  resolution: {
    type: String,
    maxlength: 2000
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedAt: Date
  },
  firstResponseAt: Date,
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Generate ticket number
supportTicketSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await this.constructor.countDocuments();
    const year = new Date().getFullYear().toString().slice(-2);
    this.ticketNumber = `TKT-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  
  this.lastActivityAt = new Date();
  next();
});

// Indexes
supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ organization: 1, status: 1 });
supportTicketSchema.index({ assignedTo: 1, status: 1 });
supportTicketSchema.index({ ticketNumber: 1 });
supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ priority: 1, status: 1 });

// Virtual for response time calculation
supportTicketSchema.virtual('responseTime').get(function() {
  if (this.firstResponseAt && this.createdAt) {
    return this.firstResponseAt - this.createdAt;
  }
  return null;
});

// Virtual for resolution time calculation
supportTicketSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return this.resolvedAt - this.createdAt;
  }
  return null;
});

// Method to add message
supportTicketSchema.methods.addMessage = function(senderId, content, isStaffReply = false, attachments = []) {
  this.messages.push({
    sender: senderId,
    content,
    isStaffReply,
    attachments
  });
  
  if (isStaffReply && !this.firstResponseAt) {
    this.firstResponseAt = new Date();
  }
  
  return this.save();
};

// Static method to get ticket stats
supportTicketSchema.statics.getStats = async function(organizationId = null) {
  const match = organizationId 
    ? { organization: organizationId, isDeleted: false }
    : { isDeleted: false };
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        avgRating: { $avg: '$rating.score' }
      }
    }
  ]);
  
  return stats[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, avgRating: null };
};

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
