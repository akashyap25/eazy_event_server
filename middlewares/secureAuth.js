const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Token = require('../models/Token');
const { securityConfig } = require('../config/security');

// Enhanced authentication middleware with session management
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, securityConfig.jwt.secret, {
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience
    });
    
    // Check if token exists in database and is not blacklisted
    const tokenDoc = await Token.findValidToken(token, 'access');
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }

    // Find user by ID from token
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Check for account lockout
    if (user.isLocked && user.lockoutUntil && user.lockoutUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts',
        code: 'ACCOUNT_LOCKED',
        lockoutUntil: user.lockoutUntil
      });
    }

    // Update token last used
    await tokenDoc.updateLastUsed();

    // Attach user info to request
    req.user = user;
    req.auth = {
      userId: user._id.toString(),
      userRole: user.role,
      tokenId: tokenDoc._id
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, securityConfig.jwt.secret, {
        issuer: securityConfig.jwt.issuer,
        audience: securityConfig.jwt.audience
      });
      
      const tokenDoc = await Token.findValidToken(token, 'access');
      if (tokenDoc) {
        const user = await User.findById(decoded.userId);
        if (user && user.isActive) {
          req.user = user;
          req.auth = {
            userId: user._id.toString(),
            userRole: user.role,
            tokenId: tokenDoc._id
          };
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

// Generate JWT access token
const generateAccessToken = (userId) => {
  return jwt.sign(
    { 
      userId,
      type: 'access',
      iat: Math.floor(Date.now() / 1000)
    },
    securityConfig.jwt.secret,
    { 
      expiresIn: securityConfig.jwt.expiresIn,
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience
    }
  );
};

// Generate JWT refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { 
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000)
    },
    securityConfig.jwt.secret,
    { 
      expiresIn: securityConfig.jwt.refreshExpiresIn,
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience
    }
  );
};

// Generate token pair (access + refresh)
const generateTokenPair = async (userId, userAgent, ipAddress, deviceInfo) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  // Store tokens in database
  await Promise.all([
    Token.createAccessToken(userId, userAgent, ipAddress, deviceInfo),
    Token.createRefreshToken(userId, userAgent, ipAddress, deviceInfo)
  ]);
  
  return { accessToken, refreshToken };
};

// Refresh access token using refresh token
const refreshAccessToken = async (refreshToken, userAgent, ipAddress, deviceInfo) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, securityConfig.jwt.secret, {
      issuer: securityConfig.jwt.issuer,
      audience: securityConfig.jwt.audience
    });
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    // Check if refresh token exists in database
    const tokenDoc = await Token.findValidToken(refreshToken, 'refresh');
    if (!tokenDoc) {
      throw new Error('Refresh token not found or expired');
    }
    
    // Generate new access token
    const newAccessToken = generateAccessToken(decoded.userId);
    
    // Store new access token
    await Token.createAccessToken(decoded.userId, userAgent, ipAddress, deviceInfo);
    
    return { accessToken: newAccessToken };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

// Logout - blacklist tokens
const logout = async (req, res, next) => {
  try {
    const { tokenId } = req.auth;
    
    if (tokenId) {
      // Blacklist current token
      await Token.findByIdAndUpdate(tokenId, { isBlacklisted: true });
    }
    
    next();
  } catch (error) {
    console.error('Logout error:', error);
    next();
  }
};

// Logout all devices - blacklist all user tokens
const logoutAllDevices = async (userId) => {
  try {
    await Token.blacklistAllUserTokens(userId);
  } catch (error) {
    console.error('Logout all devices error:', error);
    throw error;
  }
};

// Clean up expired tokens (should be called periodically)
const cleanupExpiredTokens = async () => {
  try {
    const result = await Token.cleanupExpiredTokens();
    console.log(`Cleaned up ${result.deletedCount} expired tokens`);
  } catch (error) {
    console.error('Token cleanup error:', error);
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  refreshAccessToken,
  logout,
  logoutAllDevices,
  cleanupExpiredTokens
};