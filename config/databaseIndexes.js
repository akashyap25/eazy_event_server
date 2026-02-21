const { createIndexes } = require('../utils/databaseIndexer');

// Comprehensive database indexing strategy
const INDEX_CONFIG = {
  // User model indexes
  User: [
    // Single field indexes
    { email: 1 },
    { username: 1 },
    { role: 1 },
    { isActive: 1 },
    { isEmailVerified: 1 },
    { createdAt: -1 },
    { lastLogin: -1 },
    
    // Compound indexes for common queries
    { email: 1, isActive: 1 },
    { role: 1, isActive: 1 },
    { isEmailVerified: 1, isActive: 1 },
    { createdAt: -1, isActive: 1 },
    
    // Text search index
    { 
      username: 'text', 
      firstName: 'text', 
      lastName: 'text', 
      email: 'text' 
    }
  ],

  // Event model indexes
  Event: [
    // Single field indexes
    { title: 1 },
    { status: 1 },
    { category: 1 },
    { location: 1 },
    { startDateTime: 1 },
    { endDateTime: 1 },
    { isActive: 1 },
    { createdAt: -1 },
    { updatedAt: -1 },
    { price: 1 },
    { maxAttendees: 1 },
    
    // Compound indexes for common queries
    { status: 1, isActive: 1 },
    { category: 1, status: 1 },
    { startDateTime: 1, status: 1 },
    { location: 1, startDateTime: 1 },
    { organizer: 1, status: 1 },
    { organizer: 1, isActive: 1 },
    { startDateTime: 1, endDateTime: 1 },
    { price: 1, status: 1 },
    { maxAttendees: 1, status: 1 },
    
    // Geospatial index for location-based queries
    { 'location.coordinates': '2dsphere' },
    
    // Text search index
    { 
      title: 'text', 
      description: 'text', 
      location: 'text',
      category: 'text'
    },
    
    // Partial indexes for performance
    { status: 1, startDateTime: 1 }, { partialFilterExpression: { isActive: true } },
    { organizer: 1, createdAt: -1 }, { partialFilterExpression: { isActive: true } }
  ],

  // Category model indexes
  Category: [
    { name: 1 },
    { isActive: 1 },
    { createdAt: -1 },
    { name: 1, isActive: 1 }
  ],

  // Task model indexes
  Task: [
    { eventId: 1 },
    { assignedTo: 1 },
    { status: 1 },
    { priority: 1 },
    { dueDate: 1 },
    { createdAt: -1 },
    { eventId: 1, status: 1 },
    { assignedTo: 1, status: 1 },
    { priority: 1, dueDate: 1 },
    { eventId: 1, assignedTo: 1 },
    { status: 1, dueDate: 1 }
  ],

  // Token model indexes
  Token: [
    { token: 1 },
    { userId: 1 },
    { tokenType: 1 },
    { isBlacklisted: 1 },
    { expiresAt: 1 },
    { userId: 1, tokenType: 1 },
    { token: 1, isBlacklisted: 1 },
    { expiresAt: 1, isBlacklisted: 1 },
    { userId: 1, expiresAt: 1 }
  ],

  // PasswordReset model indexes
  PasswordReset: [
    { email: 1 },
    { hashedToken: 1 },
    { isUsed: 1 },
    { expiresAt: 1 },
    { email: 1, isUsed: 1 },
    { hashedToken: 1, isUsed: 1 },
    { expiresAt: 1, isUsed: 1 }
  ],

  // Order model indexes
  Order: [
    { userId: 1 },
    { eventId: 1 },
    { status: 1 },
    { paymentStatus: 1 },
    { createdAt: -1 },
    { userId: 1, status: 1 },
    { eventId: 1, status: 1 },
    { paymentStatus: 1, status: 1 },
    { userId: 1, createdAt: -1 }
  ],

  // EventTemplate model indexes
  EventTemplate: [
    { category: 1 },
    { isPublic: 1, isActive: 1 },
    { createdBy: 1 },
    { usageCount: -1 },
    { rating: -1 },
    { name: 'text', description: 'text' }
  ],

  // EventAnalytics model indexes
  EventAnalytics: [
    { eventId: 1 },
    { lastUpdated: -1 },
    { 'views.total': -1 },
    { 'registrations.total': -1 },
    { 'engagement.engagementScore': -1 }
  ]
};

// Index creation function
const createAllIndexes = async () => {
  try {
    console.log('🚀 Starting database indexing...');
    
    for (const [modelName, indexes] of Object.entries(INDEX_CONFIG)) {
      console.log(`📊 Creating indexes for ${modelName}...`);
      await createIndexes(modelName, indexes);
    }
    
    console.log('✅ Database indexing completed successfully!');
  } catch (error) {
    console.error('❌ Error creating database indexes:', error);
    throw error;
  }
};

module.exports = {
  INDEX_CONFIG,
  createAllIndexes
};