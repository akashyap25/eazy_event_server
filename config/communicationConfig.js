/**
 * Centralized Communication Configuration
 * Industry-standard configuration management for all communication services
 */

const nodemailer = require('nodemailer');
const twilio = require('twilio');

class CommunicationConfig {
  constructor() {
    this.emailConfig = this.getEmailConfig();
    this.smsConfig = this.getSMSConfig();
    this.emailTransporter = null;
    this.smsClient = null;
  }

  /**
   * Get email configuration
   * @returns {Object} Email configuration object
   */
  getEmailConfig() {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      from: {
        name: process.env.SMTP_FROM_NAME || 'Eazy Event',
        address: process.env.SMTP_FROM || process.env.SMTP_USER
      },
      // Connection pool settings
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 20000,
      rateLimit: 5
    };
  }

  /**
   * Get SMS configuration
   * @returns {Object} SMS configuration object
   */
  getSMSConfig() {
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
      // Rate limiting
      maxMessagesPerMinute: 60,
      maxMessagesPerHour: 1000
    };
  }

  /**
   * Get email transporter (singleton pattern)
   * @returns {Object} Nodemailer transporter
   */
  getEmailTransporter() {
    if (!this.emailTransporter) {
      this.emailTransporter = nodemailer.createTransport(this.emailConfig);
      
      // Verify connection
      this.emailTransporter.verify((error, success) => {
        if (error) {
          console.error('Email transporter verification failed:', error);
        } else {
          console.log('Email transporter ready');
        }
      });
    }
    return this.emailTransporter;
  }

  /**
   * Get SMS client (singleton pattern)
   * @returns {Object} Twilio client
   */
  getSMSClient() {
    if (!this.smsClient) {
      if (!this.smsConfig.accountSid || !this.smsConfig.authToken) {
        console.warn('SMS configuration incomplete. SMS features will be disabled.');
        return null;
      }
      this.smsClient = twilio(this.smsConfig.accountSid, this.smsConfig.authToken);
    }
    return this.smsClient;
  }

  /**
   * Validate email configuration
   * @returns {Boolean} Configuration validity
   */
  isEmailConfigured() {
    return !!(this.emailConfig.auth.user && this.emailConfig.auth.pass);
  }

  /**
   * Validate SMS configuration
   * @returns {Boolean} Configuration validity
   */
  isSMSConfigured() {
    return !!(this.smsConfig.accountSid && this.smsConfig.authToken && this.smsConfig.phoneNumber);
  }

  /**
   * Get configuration status
   * @returns {Object} Status of all communication services
   */
  getStatus() {
    return {
      email: {
        configured: this.isEmailConfigured(),
        host: this.emailConfig.host,
        port: this.emailConfig.port
      },
      sms: {
        configured: this.isSMSConfigured(),
        phoneNumber: this.smsConfig.phoneNumber
      }
    };
  }
}

// Export singleton instance
module.exports = new CommunicationConfig();