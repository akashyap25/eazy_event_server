const mongoose = require('mongoose');
const dotenv = require('dotenv');
const logger = require('../utils/logger');
const { createAllIndexes } = require('../config/databaseIndexes');

dotenv.config();

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  logger.error('MONGO_URI is not defined in environment variables');
  process.exit(1);
}

let isConnected = false;

// MongoDB connection options with enhanced performance
const options = {
  maxPoolSize: 20, // Increased connection pool size
  minPoolSize: 5, // Minimum connections to maintain
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  // Removed deprecated options
  // Performance optimizations
  readPreference: 'secondaryPreferred', // Read from secondary when available
  readConcern: { level: 'local' },
  writeConcern: { w: 'majority', j: true }
};

async function connectToMongo() {
  if (isConnected) {
    logger.info('Already connected to MongoDB');
    return;
  }

  try {
    await mongoose.connect(mongoUri, options);
    isConnected = true;
    logger.info('Connected to MongoDB successfully');
    
    // Load all models first
    require('../models/user');
    require('../models/event');
    require('../models/category');
    require('../models/task');
    require('../models/Token');
    require('../models/PasswordReset');
    require('../models/order');
    require('../models/eventTemplate');
    require('../models/eventAnalytics');
    
    logger.info('All models loaded successfully');
    
    // Create database indexes for optimal performance
    try {
      await createAllIndexes();
      logger.info('Database indexes created successfully');
    } catch (indexError) {
      logger.warn('Warning: Some indexes could not be created:', indexError.message);
    }
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (error) {
    logger.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

module.exports = connectToMongo;

