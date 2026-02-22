const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const User = require('../models/user');

const generateUsername = (email, name) => {
  const base = name ? name.toLowerCase().replace(/\s+/g, '') : email.split('@')[0];
  const random = Math.floor(Math.random() * 10000);
  return `${base}${random}`;
};

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this Google ID
      let user = await User.findOne({ 'oauth.googleId': profile.id });
      
      if (user) {
        return done(null, user);
      }
      
      // Check if user exists with the same email
      const email = profile.emails?.[0]?.value;
      if (email) {
        user = await User.findOne({ email: email.toLowerCase() });
        
        if (user) {
          // Link Google account to existing user
          user.oauth.googleId = profile.id;
          if (!user.avatar && profile.photos?.[0]?.value) {
            user.avatar = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const newUser = await User.create({
        email: email,
        firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
        lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
        username: generateUsername(email, profile.displayName),
        avatar: profile.photos?.[0]?.value || '',
        oauth: { googleId: profile.id },
        authProvider: 'google',
        isEmailVerified: true,
        password: undefined
      });
      
      return done(null, newUser);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }));
}

// GitHub OAuth Strategy
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
    scope: ['user:email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists with this GitHub ID
      let user = await User.findOne({ 'oauth.githubId': profile.id });
      
      if (user) {
        return done(null, user);
      }
      
      // Get email from profile
      const email = profile.emails?.[0]?.value || `${profile.username}@github.local`;
      
      // Check if user exists with the same email
      if (email && !email.endsWith('@github.local')) {
        user = await User.findOne({ email: email.toLowerCase() });
        
        if (user) {
          // Link GitHub account to existing user
          user.oauth.githubId = profile.id;
          if (!user.avatar && profile.photos?.[0]?.value) {
            user.avatar = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }
      }
      
      // Parse name from display name or username
      const displayName = profile.displayName || profile.username;
      const nameParts = displayName?.split(' ') || [];
      
      // Create new user
      const newUser = await User.create({
        email: email,
        firstName: nameParts[0] || profile.username || 'User',
        lastName: nameParts.slice(1).join(' ') || '',
        username: profile.username || generateUsername(email, displayName),
        avatar: profile.photos?.[0]?.value || '',
        oauth: { githubId: profile.id },
        authProvider: 'github',
        isEmailVerified: !email.endsWith('@github.local'),
        password: undefined
      });
      
      return done(null, newUser);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return done(error, null);
    }
  }));
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
