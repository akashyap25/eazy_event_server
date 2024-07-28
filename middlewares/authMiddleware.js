const { ClerkExpressWithAuth } = require('@clerk/clerk-sdk-node');

const authMiddleware = ClerkExpressWithAuth({
  apiKey: process.env.CLERK_PUBLISHABLE_KEY,
});

module.exports = authMiddleware;
