const communicationConfig = require('../config/communicationConfig');
const Event = require('../models/event');
const { User } = require('../models/user');

class EmailTemplateService {
  constructor() {
    this.transporter = communicationConfig.getEmailTransporter();
    this.isConfigured = communicationConfig.isEmailConfigured();
  }

  /**
   * Send email using template
   * @param {String} to - Recipient email
   * @param {String} subject - Email subject
   * @param {String} html - HTML content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(to, subject, html, options = {}) {
    try {
      const mailOptions = {
        from: {
          name: 'Eazy Event',
          address: process.env.SMTP_USER
        },
        to,
        subject,
        html,
        ...options
      };

      const result = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Generate base email template
   * @param {Object} data - Template data
   * @returns {String} HTML template
   */
  generateBaseTemplate(data) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title || 'Eazy Event'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 30px 20px;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover {
            opacity: 0.9;
          }
          .event-card {
            border: 1px solid #e1e5e9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            background-color: #f8f9fa;
          }
          .event-title {
            font-size: 20px;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 10px;
          }
          .event-details {
            color: #4a5568;
            margin-bottom: 5px;
          }
          .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .footer a {
            color: #667eea;
            text-decoration: none;
          }
          .divider {
            height: 1px;
            background-color: #e1e5e9;
            margin: 20px 0;
          }
          .highlight {
            background-color: #fef3cd;
            border: 1px solid #fde68a;
            border-radius: 4px;
            padding: 12px;
            margin: 15px 0;
          }
          .success {
            background-color: #d1fae5;
            border: 1px solid #a7f3d0;
            color: #065f46;
          }
          .warning {
            background-color: #fef3cd;
            border: 1px solid #fde68a;
            color: #92400e;
          }
          .error {
            background-color: #fee2e2;
            border: 1px solid #fecaca;
            color: #991b1b;
          }
          @media (max-width: 600px) {
            body {
              padding: 10px;
            }
            .header h1 {
              font-size: 24px;
            }
            .content {
              padding: 20px 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.title || 'Eazy Event'}</h1>
            ${data.subtitle ? `<p style="margin: 10px 0 0 0; opacity: 0.9;">${data.subtitle}</p>` : ''}
          </div>
          <div class="content">
            ${data.content || ''}
          </div>
          <div class="footer">
            <p>This email was sent by <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">Eazy Event</a></p>
            <p>If you no longer wish to receive these emails, you can <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/unsubscribe">unsubscribe</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Event registration confirmation email
   * @param {Object} data - Event and user data
   * @returns {String} HTML email
   */
  generateEventRegistrationEmail(data) {
    const { event, user, order } = data;
    
    const content = `
      <h2>🎉 Registration Confirmed!</h2>
      <p>Hi ${user.firstName},</p>
      <p>Thank you for registering for <strong>${event.title}</strong>. We're excited to have you join us!</p>
      
      <div class="event-card">
        <div class="event-title">${event.title}</div>
        <div class="event-details"><strong>📅 Date:</strong> ${new Date(event.startDateTime).toLocaleDateString()}</div>
        <div class="event-details"><strong>🕐 Time:</strong> ${new Date(event.startDateTime).toLocaleTimeString()}</div>
        <div class="event-details"><strong>📍 Location:</strong> ${event.location}</div>
        <div class="event-details"><strong>💰 Price:</strong> ${event.isFree ? 'FREE' : `₹${event.price}`}</div>
        ${event.description ? `<div class="event-details"><strong>📝 Description:</strong> ${event.description}</div>` : ''}
      </div>

      <div class="highlight success">
        <strong>✅ Registration Details:</strong><br>
        Order ID: ${order._id}<br>
        Registration Date: ${new Date(order.createdAt).toLocaleDateString()}<br>
        Status: Confirmed
      </div>

      <p>We'll send you a reminder before the event starts. If you have any questions, feel free to contact us.</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/events/${event._id}" class="button">View Event Details</a>
      </div>
    `;

    return this.generateBaseTemplate({
      title: 'Registration Confirmed - Eazy Event',
      subtitle: 'You\'re all set for the event!',
      content
    });
  }

  /**
   * Event reminder email
   * @param {Object} data - Event and user data
   * @returns {String} HTML email
   */
  generateEventReminderEmail(data) {
    const { event, user, reminderType = '24h' } = data;
    
    const timeUntilEvent = this.getTimeUntilEvent(event.startDateTime);
    
    const content = `
      <h2>⏰ Event Reminder</h2>
      <p>Hi ${user.firstName},</p>
      <p>This is a friendly reminder that <strong>${event.title}</strong> is coming up soon!</p>
      
      <div class="event-card">
        <div class="event-title">${event.title}</div>
        <div class="event-details"><strong>📅 Date:</strong> ${new Date(event.startDateTime).toLocaleDateString()}</div>
        <div class="event-details"><strong>🕐 Time:</strong> ${new Date(event.startDateTime).toLocaleTimeString()}</div>
        <div class="event-details"><strong>📍 Location:</strong> ${event.location}</div>
        <div class="event-details"><strong>⏱️ Time Until Event:</strong> ${timeUntilEvent}</div>
      </div>

      <div class="highlight">
        <strong>📋 Don't forget to:</strong><br>
        • Mark your calendar<br>
        • Set a reminder on your phone<br>
        • Check the event location and parking<br>
        • Bring any required items
      </div>

      <p>We're looking forward to seeing you there!</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/events/${event._id}" class="button">View Event Details</a>
      </div>
    `;

    return this.generateBaseTemplate({
      title: 'Event Reminder - Eazy Event',
      subtitle: `Reminder: ${event.title}`,
      content
    });
  }

  /**
   * Event cancellation email
   * @param {Object} data - Event and user data
   * @returns {String} HTML email
   */
  generateEventCancellationEmail(data) {
    const { event, user, reason } = data;
    
    const content = `
      <h2>❌ Event Cancelled</h2>
      <p>Hi ${user.firstName},</p>
      <p>We're sorry to inform you that <strong>${event.title}</strong> has been cancelled.</p>
      
      <div class="event-card">
        <div class="event-title">${event.title}</div>
        <div class="event-details"><strong>📅 Date:</strong> ${new Date(event.startDateTime).toLocaleDateString()}</div>
        <div class="event-details"><strong>🕐 Time:</strong> ${new Date(event.startDateTime).toLocaleTimeString()}</div>
        <div class="event-details"><strong>📍 Location:</strong> ${event.location}</div>
      </div>

      ${reason ? `
        <div class="highlight warning">
          <strong>📝 Cancellation Reason:</strong><br>
          ${reason}
        </div>
      ` : ''}

      <div class="highlight success">
        <strong>💰 Refund Information:</strong><br>
        If you paid for this event, a full refund will be processed within 3-5 business days.<br>
        You'll receive a separate email confirmation once the refund is processed.
      </div>

      <p>We apologize for any inconvenience this may cause. We hope to see you at future events!</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/events" class="button">Browse Other Events</a>
      </div>
    `;

    return this.generateBaseTemplate({
      title: 'Event Cancelled - Eazy Event',
      subtitle: 'We apologize for the inconvenience',
      content
    });
  }

  /**
   * Event update email
   * @param {Object} data - Event and user data
   * @returns {String} HTML email
   */
  generateEventUpdateEmail(data) {
    const { event, user, updates } = data;
    
    const content = `
      <h2>📝 Event Updated</h2>
      <p>Hi ${user.firstName},</p>
      <p>The event <strong>${event.title}</strong> has been updated with new information.</p>
      
      <div class="event-card">
        <div class="event-title">${event.title}</div>
        <div class="event-details"><strong>📅 Date:</strong> ${new Date(event.startDateTime).toLocaleDateString()}</div>
        <div class="event-details"><strong>🕐 Time:</strong> ${new Date(event.startDateTime).toLocaleTimeString()}</div>
        <div class="event-details"><strong>📍 Location:</strong> ${event.location}</div>
      </div>

      <div class="highlight">
        <strong>🔄 What's Changed:</strong><br>
        ${updates.map(update => `• ${update}`).join('<br>')}
      </div>

      <p>Please review the updated event details. If you have any questions, feel free to contact us.</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/events/${event._id}" class="button">View Updated Event</a>
      </div>
    `;

    return this.generateBaseTemplate({
      title: 'Event Updated - Eazy Event',
      subtitle: 'Important updates to your event',
      content
    });
  }

  /**
   * Password reset email
   * @param {Object} data - User and reset data
   * @returns {String} HTML email
   */
  generatePasswordResetEmail(data) {
    const { user, resetToken } = data;
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const content = `
      <h2>🔐 Password Reset Request</h2>
      <p>Hi ${user.firstName},</p>
      <p>We received a request to reset your password for your Eazy Event account.</p>
      
      <div class="highlight">
        <strong>⚠️ Important:</strong><br>
        If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
      </div>

      <p>To reset your password, click the button below:</p>
      
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>

      <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
      
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
    `;

    return this.generateBaseTemplate({
      title: 'Password Reset - Eazy Event',
      subtitle: 'Reset your account password',
      content
    });
  }

  /**
   * Email verification email
   * @param {Object} data - User and verification data
   * @returns {String} HTML email
   */
  generateEmailVerificationEmail(data) {
    const { user, verificationToken } = data;
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    
    const content = `
      <h2>✅ Verify Your Email</h2>
      <p>Hi ${user.firstName},</p>
      <p>Welcome to Eazy Event! Please verify your email address to complete your account setup.</p>
      
      <div class="highlight success">
        <strong>🎉 Account Created Successfully!</strong><br>
        Username: ${user.username}<br>
        Email: ${user.email}
      </div>

      <p>Click the button below to verify your email address:</p>
      
      <div style="text-align: center;">
        <a href="${verificationUrl}" class="button">Verify Email</a>
      </div>

      <p><strong>This verification link will expire in 24 hours.</strong></p>
      
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
    `;

    return this.generateBaseTemplate({
      title: 'Verify Your Email - Eazy Event',
      subtitle: 'Complete your account setup',
      content
    });
  }

  /**
   * Chat message notification email
   * @param {Object} data - Chat and user data
   * @returns {String} HTML email
   */
  generateChatNotificationEmail(data) {
    const { event, sender, message, recipient } = data;
    
    const content = `
      <h2>💬 New Chat Message</h2>
      <p>Hi ${recipient.firstName},</p>
      <p>You have a new message in the chat for <strong>${event.title}</strong>.</p>
      
      <div class="event-card">
        <div class="event-title">${event.title}</div>
        <div class="event-details"><strong>📅 Date:</strong> ${new Date(event.startDateTime).toLocaleDateString()}</div>
        <div class="event-details"><strong>🕐 Time:</strong> ${new Date(event.startDateTime).toLocaleTimeString()}</div>
      </div>

      <div class="highlight">
        <strong>💬 Message from ${sender.firstName} ${sender.lastName}:</strong><br>
        "${message.length > 200 ? message.substring(0, 200) + '...' : message}"
      </div>

      <p>Join the conversation and stay connected with other event participants!</p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/events/${event._id}" class="button">View Event Chat</a>
      </div>
    `;

    return this.generateBaseTemplate({
      title: 'New Chat Message - Eazy Event',
      subtitle: `Message from ${sender.firstName} in ${event.title}`,
      content
    });
  }

  /**
   * Get time until event
   * @param {Date} eventDate - Event date
   * @returns {String} Formatted time string
   */
  getTimeUntilEvent(eventDate) {
    const now = new Date();
    const event = new Date(eventDate);
    const diff = event - now;

    if (diff < 0) {
      return 'Event has passed';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} and ${hours} hour${hours > 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  }
}

module.exports = new EmailTemplateService();