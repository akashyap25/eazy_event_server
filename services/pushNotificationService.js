const webpush = require('web-push');
const { User } = require('../models/user');

class PushNotificationService {
  constructor() {
    // Initialize web-push with VAPID keys if available
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@eazyevent.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
    } else {
      console.warn('VAPID keys not configured. Push notifications will not work.');
    }
  }

  /**
   * Subscribe user to push notifications
   * @param {String} userId - User ID
   * @param {Object} subscription - Push subscription object
   * @returns {Promise<Object>} Subscription result
   */
  async subscribeUser(userId, subscription) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Store subscription in user document
      if (!user.pushSubscriptions) {
        user.pushSubscriptions = [];
      }

      // Check if subscription already exists
      const existingSubscription = user.pushSubscriptions.find(sub => 
        sub.endpoint === subscription.endpoint
      );

      if (!existingSubscription) {
        user.pushSubscriptions.push({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          subscribedAt: new Date()
        });

        await user.save();
      }

      return {
        success: true,
        message: 'Successfully subscribed to push notifications'
      };
    } catch (error) {
      throw new Error(`Failed to subscribe user: ${error.message}`);
    }
  }

  /**
   * Unsubscribe user from push notifications
   * @param {String} userId - User ID
   * @param {String} endpoint - Subscription endpoint
   * @returns {Promise<Object>} Unsubscription result
   */
  async unsubscribeUser(userId, endpoint) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.pushSubscriptions) {
        user.pushSubscriptions = user.pushSubscriptions.filter(sub => 
          sub.endpoint !== endpoint
        );
        await user.save();
      }

      return {
        success: true,
        message: 'Successfully unsubscribed from push notifications'
      };
    } catch (error) {
      throw new Error(`Failed to unsubscribe user: ${error.message}`);
    }
  }

  /**
   * Send push notification to a single user
   * @param {String} userId - User ID
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send result
   */
  async sendToUser(userId, notification) {
    try {
      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        return {
          success: false,
          message: 'Push notifications not configured'
        };
      }

      const user = await User.findById(userId);
      if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
        return {
          success: false,
          message: 'User not found or no subscriptions'
        };
      }

      const results = [];
      const payload = JSON.stringify(notification);

      for (const subscription of user.pushSubscriptions) {
        try {
          await webpush.sendNotification(subscription, payload);
          results.push({ success: true, endpoint: subscription.endpoint });
        } catch (error) {
          console.error('Failed to send notification:', error);
          results.push({ 
            success: false, 
            endpoint: subscription.endpoint, 
            error: error.message 
          });

          // Remove invalid subscription
          if (error.statusCode === 410) {
            user.pushSubscriptions = user.pushSubscriptions.filter(sub => 
              sub.endpoint !== subscription.endpoint
            );
          }
        }
      }

      await user.save();

      return {
        success: results.some(r => r.success),
        results
      };
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Send push notification to multiple users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send result
   */
  async sendToUsers(userIds, notification) {
    try {
      const results = [];
      
      for (const userId of userIds) {
        const result = await this.sendToUser(userId, notification);
        results.push({ userId, ...result });
      }

      return {
        success: results.some(r => r.success),
        results
      };
    } catch (error) {
      throw new Error(`Failed to send notifications: ${error.message}`);
    }
  }

  /**
   * Send event-related notification
   * @param {String} eventId - Event ID
   * @param {String} type - Notification type
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Send result
   */
  async sendEventNotification(eventId, type, data) {
    try {
      const notification = {
        title: data.title || 'Event Update',
        body: data.body || 'You have a new event notification',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/badge-72x72.png',
        data: {
          eventId,
          type,
          url: data.url || `/events/${eventId}`,
          ...data.data
        },
        actions: data.actions || [
          {
            action: 'view',
            title: 'View Event',
            icon: '/icons/view-icon.png'
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
            icon: '/icons/dismiss-icon.png'
          }
        ],
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
        vibrate: data.vibrate || [200, 100, 200],
        tag: `event-${eventId}-${type}`,
        renotify: data.renotify || false
      };

      // Get event attendees
      const { Order } = require('../models/order');
      const orders = await Order.find({
        eventId,
        status: 'confirmed'
      }).populate('userId', 'pushSubscriptions');

      const userIds = orders.map(order => order.userId._id);
      
      return await this.sendToUsers(userIds, notification);
    } catch (error) {
      throw new Error(`Failed to send event notification: ${error.message}`);
    }
  }

  /**
   * Send chat notification
   * @param {String} roomId - Chat room ID
   * @param {String} senderId - Sender user ID
   * @param {String} message - Message content
   * @param {Array} recipientIds - Array of recipient user IDs
   * @returns {Promise<Object>} Send result
   */
  async sendChatNotification(roomId, senderId, message, recipientIds) {
    try {
      const sender = await User.findById(senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      const notification = {
        title: `New message from ${sender.firstName} ${sender.lastName}`,
        body: message.length > 100 ? message.substring(0, 100) + '...' : message,
        icon: sender.avatar || '/icons/default-avatar.png',
        badge: '/icons/chat-badge.png',
        data: {
          type: 'chat',
          roomId,
          senderId,
          url: `/events/chat/${roomId}`
        },
        actions: [
          {
            action: 'reply',
            title: 'Reply',
            icon: '/icons/reply-icon.png'
          },
          {
            action: 'view',
            title: 'View Chat',
            icon: '/icons/chat-icon.png'
          }
        ],
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        tag: `chat-${roomId}`,
        renotify: true
      };

      return await this.sendToUsers(recipientIds, notification);
    } catch (error) {
      throw new Error(`Failed to send chat notification: ${error.message}`);
    }
  }

  /**
   * Send system notification
   * @param {Array} userIds - Array of user IDs
   * @param {Object} notification - Notification payload
   * @returns {Promise<Object>} Send result
   */
  async sendSystemNotification(userIds, notification) {
    try {
      const payload = {
        title: notification.title || 'System Notification',
        body: notification.body || 'You have a new notification',
        icon: notification.icon || '/icons/system-icon.png',
        badge: notification.badge || '/icons/system-badge.png',
        data: {
          type: 'system',
          ...notification.data
        },
        actions: notification.actions || [
          {
            action: 'view',
            title: 'View',
            icon: '/icons/view-icon.png'
          }
        ],
        requireInteraction: notification.requireInteraction || false,
        silent: notification.silent || false,
        vibrate: notification.vibrate || [200, 100, 200],
        tag: notification.tag || 'system',
        renotify: notification.renotify || false
      };

      return await this.sendToUsers(userIds, payload);
    } catch (error) {
      throw new Error(`Failed to send system notification: ${error.message}`);
    }
  }

  /**
   * Get VAPID public key for client
   * @returns {String} VAPID public key
   */
  getVapidPublicKey() {
    if (!process.env.VAPID_PUBLIC_KEY) {
      throw new Error('VAPID public key not configured');
    }
    return process.env.VAPID_PUBLIC_KEY;
  }

  /**
   * Test push notification
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Test result
   */
  async testNotification(userId) {
    try {
      const notification = {
        title: 'Test Notification',
        body: 'This is a test push notification from Eazy Event',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        data: {
          type: 'test',
          url: '/'
        },
        actions: [
          {
            action: 'view',
            title: 'View App',
            icon: '/icons/view-icon.png'
          }
        ],
        requireInteraction: false,
        silent: false,
        vibrate: [200, 100, 200],
        tag: 'test',
        renotify: false
      };

      return await this.sendToUser(userId, notification);
    } catch (error) {
      throw new Error(`Failed to send test notification: ${error.message}`);
    }
  }
}

module.exports = new PushNotificationService();