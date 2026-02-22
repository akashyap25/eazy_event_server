const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'event_reminder',
      'event_update',
      'event_cancelled',
      'task_assigned',
      'task_updated',
      'task_due_soon',
      'order_confirmed',
      'order_cancelled',
      'organization_invite',
      'organization_role_changed',
      'new_message',
      'event_registration',
      'system_announcement',
      'support_reply'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  data: {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    url: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  expiresAt: {
    type: Date
  },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  deliveryStatus: {
    inApp: { type: String, enum: ['pending', 'sent', 'failed'], default: 'sent' },
    email: { type: String, enum: ['pending', 'sent', 'failed'] },
    push: { type: String, enum: ['pending', 'sent', 'failed'] },
    sms: { type: String, enum: ['pending', 'sent', 'failed'] }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Mark as read
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, read: false });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  return notification;
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
