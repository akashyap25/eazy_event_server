const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Generate JWT tokens
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// OAuth callback handler
const handleOAuthCallback = (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
    }
    
    const { accessToken, refreshToken } = generateTokens(req.user);
    
    // Update last login
    req.user.updateLastLogin();
    
    // Redirect to frontend with tokens
    const redirectUrl = new URL(`${process.env.FRONTEND_URL}/oauth/callback`);
    redirectUrl.searchParams.append('accessToken', accessToken);
    redirectUrl.searchParams.append('refreshToken', refreshToken);
    
    res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/sign-in?error=auth_failed`);
  }
};

// Google OAuth routes
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

router.get('/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=google_auth_failed`,
    session: false
  }),
  handleOAuthCallback
);

// GitHub OAuth routes
router.get('/github',
  passport.authenticate('github', { 
    scope: ['user:email'],
    session: false 
  })
);

router.get('/github/callback',
  passport.authenticate('github', { 
    failureRedirect: `${process.env.FRONTEND_URL}/sign-in?error=github_auth_failed`,
    session: false
  }),
  handleOAuthCallback
);

// Link OAuth account to existing user
router.post('/link/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { oauthId, email } = req.body;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const validProviders = ['google', 'github', 'facebook', 'linkedin', 'twitter'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OAuth provider'
      });
    }
    
    // Update user with OAuth ID
    req.user.oauth[`${provider}Id`] = oauthId;
    await req.user.save();
    
    res.json({
      success: true,
      message: `${provider} account linked successfully`
    });
  } catch (error) {
    console.error('Link OAuth error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link account'
    });
  }
});

// Unlink OAuth account
router.delete('/unlink/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user has password set (can't unlink if no password)
    if (req.user.authProvider !== 'local' && !req.user.password) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unlink OAuth account. Please set a password first.'
      });
    }
    
    // Remove OAuth ID
    req.user.oauth[`${provider}Id`] = undefined;
    await req.user.save();
    
    res.json({
      success: true,
      message: `${provider} account unlinked successfully`
    });
  } catch (error) {
    console.error('Unlink OAuth error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlink account'
    });
  }
});

// Get linked accounts
router.get('/linked-accounts', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const linkedAccounts = {
      google: !!req.user.oauth?.googleId,
      github: !!req.user.oauth?.githubId,
      facebook: !!req.user.oauth?.facebookId,
      linkedin: !!req.user.oauth?.linkedinId,
      twitter: !!req.user.oauth?.twitterId
    };
    
    res.json({
      success: true,
      data: {
        authProvider: req.user.authProvider,
        linkedAccounts
      }
    });
  } catch (error) {
    console.error('Get linked accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get linked accounts'
    });
  }
});

module.exports = router;
