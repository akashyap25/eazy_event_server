const Token = require('../models/Token');
const PasswordReset = require('../models/PasswordReset');
const { cleanupExpiredTokens } = require('../middlewares/secureAuth');

class CleanupService {
  constructor() {
    this.isRunning = false;
  }

  // Start the cleanup service
  start() {
    if (this.isRunning) {
      console.log('Cleanup service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting cleanup service...');

    // Run cleanup every hour
    this.interval = setInterval(async () => {
      await this.runCleanup();
    }, 60 * 60 * 1000); // 1 hour

    // Run initial cleanup
    this.runCleanup();
  }

  // Stop the cleanup service
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('Cleanup service stopped');
  }

  // Run cleanup tasks
  async runCleanup() {
    try {
      console.log('Running cleanup tasks...');
      
      const results = await Promise.allSettled([
        this.cleanupExpiredTokens(),
        this.cleanupExpiredPasswordResets(),
        this.cleanupOldSessions()
      ]);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Cleanup task ${index} failed:`, result.reason);
        }
      });

      console.log('Cleanup tasks completed');
    } catch (error) {
      console.error('Cleanup service error:', error);
    }
  }

  // Clean up expired tokens
  async cleanupExpiredTokens() {
    try {
      const result = await Token.cleanupExpiredTokens();
      console.log(`Cleaned up ${result.deletedCount} expired tokens`);
      return result;
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw error;
    }
  }

  // Clean up expired password reset requests
  async cleanupExpiredPasswordResets() {
    try {
      const result = await PasswordReset.cleanupExpiredRequests();
      console.log(`Cleaned up ${result.deletedCount} expired password reset requests`);
      return result;
    } catch (error) {
      console.error('Error cleaning up expired password resets:', error);
      throw error;
    }
  }

  // Clean up old sessions (optional - handled by MongoDB TTL)
  async cleanupOldSessions() {
    try {
      // This would be handled by MongoDB TTL indexes
      // But we can add custom cleanup logic here if needed
      console.log('Session cleanup completed (handled by MongoDB TTL)');
      return { deletedCount: 0 };
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }

  // Manual cleanup trigger
  async manualCleanup() {
    console.log('Manual cleanup triggered');
    await this.runCleanup();
  }
}

module.exports = new CleanupService();