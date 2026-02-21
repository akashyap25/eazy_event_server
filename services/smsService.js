const communicationConfig = require('../config/communicationConfig');

class SMSService {
  constructor() {
    this.client = communicationConfig.getSMSClient();
    this.fromNumber = communicationConfig.smsConfig.phoneNumber;
    this.isConfigured = communicationConfig.isSMSConfigured();
  }

  /**
   * Send SMS to a single number
   * @param {String} to - Recipient phone number
   * @param {String} message - SMS message
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendSMS(to, message, options = {}) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: this.formatPhoneNumber(to),
        ...options
      });

      return {
        success: true,
        messageId: result.sid,
        status: result.status,
        to: result.to,
        from: result.from
      };
    } catch (error) {
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Send SMS to multiple numbers
   * @param {Array} phoneNumbers - Array of phone numbers
   * @param {String} message - SMS message
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send results
   */
  async sendBulkSMS(phoneNumbers, message, options = {}) {
    try {
      const results = [];
      
      for (const phoneNumber of phoneNumbers) {
        try {
          const result = await this.sendSMS(phoneNumber, message, options);
          results.push({ phoneNumber, success: true, result });
        } catch (error) {
          results.push({ phoneNumber, success: false, error: error.message });
        }
      }

      return {
        success: results.some(r => r.success),
        totalSent: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        results
      };
    } catch (error) {
      throw new Error(`Failed to send bulk SMS: ${error.message}`);
    }
  }

  /**
   * Send event registration confirmation SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {Object} event - Event data
   * @param {Object} user - User data
   * @returns {Promise<Object>} Send result
   */
  async sendEventRegistrationSMS(phoneNumber, event, user) {
    const message = `🎉 Registration confirmed! You're registered for "${event.title}" on ${new Date(event.startDateTime).toLocaleDateString()} at ${event.location}. Event starts at ${new Date(event.startDateTime).toLocaleTimeString()}. See you there! - Eazy Event`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send event reminder SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {Object} event - Event data
   * @param {String} reminderType - Type of reminder (24h, 1h, 30m)
   * @returns {Promise<Object>} Send result
   */
  async sendEventReminderSMS(phoneNumber, event, reminderType = '24h') {
    let timeText = '';
    switch (reminderType) {
      case '24h':
        timeText = '24 hours';
        break;
      case '1h':
        timeText = '1 hour';
        break;
      case '30m':
        timeText = '30 minutes';
        break;
      default:
        timeText = 'soon';
    }

    const message = `⏰ Reminder: "${event.title}" is starting in ${timeText}! Date: ${new Date(event.startDateTime).toLocaleDateString()}, Time: ${new Date(event.startDateTime).toLocaleTimeString()}, Location: ${event.location}. Don't miss it! - Eazy Event`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send event cancellation SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {Object} event - Event data
   * @param {String} reason - Cancellation reason
   * @returns {Promise<Object>} Send result
   */
  async sendEventCancellationSMS(phoneNumber, event, reason = '') {
    const reasonText = reason ? ` Reason: ${reason}.` : '';
    const message = `❌ Event cancelled: "${event.title}" scheduled for ${new Date(event.startDateTime).toLocaleDateString()} has been cancelled.${reasonText} A full refund will be processed. We apologize for any inconvenience. - Eazy Event`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send event update SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {Object} event - Event data
   * @param {Array} updates - List of updates
   * @returns {Promise<Object>} Send result
   */
  async sendEventUpdateSMS(phoneNumber, event, updates) {
    const updatesText = updates.join(', ');
    const message = `📝 Event updated: "${event.title}" has been updated. Changes: ${updatesText}. Please check the event details for more information. - Eazy Event`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send password reset SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} resetCode - Reset code
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetSMS(phoneNumber, resetCode) {
    const message = `🔐 Password reset code: ${resetCode}. This code will expire in 10 minutes. If you didn't request this, please ignore this message. - Eazy Event`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send verification code SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} verificationCode - Verification code
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationCodeSMS(phoneNumber, verificationCode) {
    const message = `✅ Verification code: ${verificationCode}. Use this code to verify your phone number. This code will expire in 10 minutes. - Eazy Event`;

    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Send chat notification SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} senderName - Sender name
   * @param {String} eventTitle - Event title
   * @param {String} message - Chat message preview
   * @returns {Promise<Object>} Send result
   */
  async sendChatNotificationSMS(phoneNumber, senderName, eventTitle, message) {
    const preview = message.length > 50 ? message.substring(0, 50) + '...' : message;
    const smsMessage = `💬 New message from ${senderName} in "${eventTitle}": "${preview}". Join the conversation! - Eazy Event`;

    return await this.sendSMS(phoneNumber, smsMessage);
  }

  /**
   * Send custom SMS
   * @param {String} phoneNumber - Recipient phone number
   * @param {String} message - Custom message
   * @returns {Promise<Object>} Send result
   */
  async sendCustomSMS(phoneNumber, message) {
    return await this.sendSMS(phoneNumber, message);
  }

  /**
   * Format phone number for Twilio
   * @param {String} phoneNumber - Phone number to format
   * @returns {String} Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    if (cleaned.length === 10) {
      cleaned = '+1' + cleaned; // Default to US
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Validate phone number format
   * @param {String} phoneNumber - Phone number to validate
   * @returns {Boolean} Validation result
   */
  validatePhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  /**
   * Get SMS delivery status
   * @param {String} messageId - Twilio message SID
   * @returns {Promise<Object>} Message status
   */
  async getSMSStatus(messageId) {
    try {
      const message = await this.client.messages(messageId).fetch();
      return {
        success: true,
        messageId: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      };
    } catch (error) {
      throw new Error(`Failed to get SMS status: ${error.message}`);
    }
  }

  /**
   * Get account balance
   * @returns {Promise<Object>} Account balance
   */
  async getAccountBalance() {
    try {
      const balance = await this.client.balance.fetch();
      return {
        success: true,
        currency: balance.currency,
        balance: balance.balance
      };
    } catch (error) {
      throw new Error(`Failed to get account balance: ${error.message}`);
    }
  }

  /**
   * Get SMS usage statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStatistics(options = {}) {
    try {
      const { startDate, endDate } = options;
      
      const messages = await this.client.messages.list({
        dateSentAfter: startDate ? new Date(startDate) : undefined,
        dateSentBefore: endDate ? new Date(endDate) : undefined,
        limit: 1000
      });

      const stats = {
        totalMessages: messages.length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        failed: messages.filter(m => m.status === 'failed').length,
        sent: messages.filter(m => m.status === 'sent').length,
        queued: messages.filter(m => m.status === 'queued').length,
        received: messages.filter(m => m.status === 'received').length,
        undelivered: messages.filter(m => m.status === 'undelivered').length
      };

      return {
        success: true,
        statistics: stats,
        period: {
          startDate: startDate || 'all time',
          endDate: endDate || 'now'
        }
      };
    } catch (error) {
      throw new Error(`Failed to get usage statistics: ${error.message}`);
    }
  }

  /**
   * Test SMS service
   * @param {String} phoneNumber - Test phone number
   * @returns {Promise<Object>} Test result
   */
  async testSMS(phoneNumber) {
    const message = '🧪 Test SMS from Eazy Event. If you received this message, SMS service is working correctly!';
    
    return await this.sendSMS(phoneNumber, message);
  }
}

module.exports = new SMSService();