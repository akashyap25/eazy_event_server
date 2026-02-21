# Security Configuration Guide

## Environment Variables Required

Create a `.env` file in the root directory with the following variables:

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/eazy_event

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here-minimum-64-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=eazy-event-app
JWT_AUDIENCE=eazy-event-users

# Session Configuration
SESSION_SECRET=your-super-secure-session-secret-key-here-minimum-32-characters
CSRF_SECRET=your-super-secure-csrf-secret-key-here-minimum-32-characters

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_BASE_URL=http://localhost:5173

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@eazyevent.com

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

## Security Features Implemented

### 1. JWT Security
- ✅ Secure JWT secret management (no hardcoded secrets)
- ✅ Short-lived access tokens (15 minutes)
- ✅ Long-lived refresh tokens (7 days)
- ✅ Token blacklisting for logout
- ✅ Token refresh mechanism
- ✅ JWT issuer and audience validation

### 2. Password Security
- ✅ Strong password policies (8+ characters, complexity requirements)
- ✅ Password history tracking (prevents reuse of last 5 passwords)
- ✅ Secure password hashing with bcrypt (12 rounds)
- ✅ Password reset functionality with secure tokens
- ✅ Account lockout after failed attempts

### 3. Rate Limiting
- ✅ Authentication endpoints: 5 attempts per 15 minutes
- ✅ Password reset: 3 attempts per hour
- ✅ General API: 100 requests per 15 minutes
- ✅ Account lockout: 5 failed attempts = 30-minute lockout

### 4. CSRF Protection
- ✅ CSRF tokens for state-changing operations
- ✅ Secure token generation and validation
- ✅ Session-based CSRF protection

### 5. Session Management
- ✅ Secure session configuration
- ✅ MongoDB session store
- ✅ Session cleanup and expiration
- ✅ Cross-device logout functionality

### 6. Account Security
- ✅ Email verification on registration
- ✅ Password change notifications
- ✅ Failed login attempt tracking
- ✅ Account lockout mechanism
- ✅ Secure password reset flow

### 7. Data Protection
- ✅ Input validation and sanitization
- ✅ SQL injection prevention (MongoDB)
- ✅ XSS protection via helmet
- ✅ Secure headers configuration

## API Endpoints

### Authentication
- `POST /api/users/register` - User registration with validation
- `POST /api/users/login` - User login with rate limiting
- `POST /api/users/logout` - Logout (blacklist current token)
- `POST /api/users/logout-all` - Logout from all devices
- `POST /api/users/refresh-token` - Refresh access token

### Password Management
- `POST /api/users/forgot-password` - Request password reset
- `POST /api/users/reset-password` - Reset password with token
- `PUT /api/users/:id/password` - Change password (authenticated)

### Security
- `GET /api/users/csrf-token` - Get CSRF token
- `GET /api/users/me` - Get current user info

## Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS**: Always use HTTPS in production
3. **Regular Updates**: Keep dependencies updated
4. **Monitoring**: Monitor failed login attempts and suspicious activity
5. **Backup**: Regular database backups
6. **Logging**: Comprehensive security event logging

## Production Checklist

- [ ] Set strong, unique secrets for JWT, session, and CSRF
- [ ] Configure proper SMTP settings for email
- [ ] Set up HTTPS certificates
- [ ] Configure production MongoDB with proper security
- [ ] Set up monitoring and alerting
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting for production load
- [ ] Enable security headers
- [ ] Set up log aggregation
- [ ] Configure backup strategy