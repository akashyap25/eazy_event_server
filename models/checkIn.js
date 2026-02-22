const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  attendee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketToken: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'checked_in', 'cancelled', 'no_show'],
    default: 'pending'
  },
  checkInTime: {
    type: Date
  },
  checkInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  checkInMethod: {
    type: String,
    enum: ['qr_scan', 'manual', 'self_service'],
    default: 'qr_scan'
  },
  checkInLocation: {
    type: String
  },
  deviceInfo: {
    type: String
  },
  ticketType: {
    type: String,
    default: 'general'
  },
  notes: {
    type: String
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  }
}, { timestamps: true });

// Indexes
checkInSchema.index({ event: 1, attendee: 1 }, { unique: true });
checkInSchema.index({ event: 1, status: 1 });
checkInSchema.index({ ticketToken: 1 });
checkInSchema.index({ order: 1 });

// Static method for check-in stats
checkInSchema.statics.getEventStats = async function(eventId) {
  const stats = await this.aggregate([
    { $match: { event: new mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        checkedIn: { $sum: { $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || { total: 0, checkedIn: 0, pending: 0, noShow: 0 };
};

// Static method for check-in timeline
checkInSchema.statics.getCheckInTimeline = async function(eventId, interval = 'hour') {
  const groupFormat = interval === 'hour' 
    ? { $hour: '$checkInTime' }
    : { $minute: '$checkInTime' };
  
  return this.aggregate([
    { 
      $match: { 
        event: new mongoose.Types.ObjectId(eventId),
        status: 'checked_in' 
      } 
    },
    {
      $group: {
        _id: groupFormat,
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

const CheckIn = mongoose.model('CheckIn', checkInSchema);
module.exports = CheckIn;
