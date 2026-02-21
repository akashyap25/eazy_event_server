const User = require('../models/user');

// Middleware to ensure user exists in database
const ensureUserExists = async (req, res, next) => {
  try {
    if (!req.auth || !req.auth.userId) {
      console.log('No auth or userId found');
      return next();
    }

    const userId = req.auth.userId;
    console.log('Looking for user with userId:', userId);
    
    let user = await User.findById(userId);

    if (!user) {
      console.log('User not found, creating new user...');
      console.log('Auth data:', {
        userId: req.auth.userId,
        clerkId: req.auth.clerkId
      });
      
      // Create user if they don't exist
      const userData = {
        clerkId: req.auth.clerkId || userId,
        email: `${userId}@local.app`,
        username: `user_${userId.slice(-8)}`,
        firstName: 'User',
        lastName: 'Name',
        photo: '',
      };

      console.log('Creating user with data:', userData);
      user = await User.create(userData);
      console.log('Created new user:', user.email);
    } else {
      console.log('Found existing user:', user.email);
    }

    // Attach user to request for use in other middleware/controllers
    req.user = user;
    next();
  } catch (error) {
    console.error('Error in ensureUserExists middleware:', error);
    next(error);
  }
};

module.exports = {
  ensureUserExists,
};