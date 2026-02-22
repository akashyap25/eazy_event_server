const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Eazy Event API',
      version: '1.0.0',
      description: `
# Eazy Event API Documentation

A comprehensive multi-tenant event management platform API.

## Features
- User authentication with JWT
- Multi-tenant organization support
- Event management (CRUD, recurring, collaboration)
- Task management
- Order and payment processing
- Real-time chat via Socket.IO
- Push notifications
- Calendar export (iCal, Google, Outlook)

## Authentication
Most endpoints require authentication via Bearer token.
Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your_access_token>
\`\`\`

## Multi-Tenancy
For organization-specific operations, include the organization ID:
\`\`\`
X-Organization-ID: <organization_id>
\`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@eazyevent.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://api.eazyevent.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', format: 'objectId' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            avatar: { type: 'string', format: 'uri' },
            role: { type: 'string', enum: ['user', 'admin', 'super_admin'] },
            isEmailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Event: {
          type: 'object',
          required: ['title', 'startDateTime', 'endDateTime'],
          properties: {
            _id: { type: 'string', format: 'objectId' },
            title: { type: 'string', maxLength: 200 },
            description: { type: 'string' },
            location: { type: 'string' },
            imageUrl: { type: 'string', format: 'uri' },
            startDateTime: { type: 'string', format: 'date-time' },
            endDateTime: { type: 'string', format: 'date-time' },
            price: { type: 'number', minimum: 0 },
            isFree: { type: 'boolean' },
            category: { type: 'string', format: 'objectId' },
            organizer: { type: 'string', format: 'objectId' },
            organizationId: { type: 'string', format: 'objectId' },
            visibility: { type: 'string', enum: ['public', 'organization', 'private', 'unlisted'] },
            capacity: { type: 'integer', minimum: 0 },
            status: { type: 'string', enum: ['upcoming', 'ongoing', 'completed', 'cancelled'] },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Organization: {
          type: 'object',
          required: ['name'],
          properties: {
            _id: { type: 'string', format: 'objectId' },
            name: { type: 'string', maxLength: 100 },
            slug: { type: 'string' },
            description: { type: 'string', maxLength: 500 },
            logo: { type: 'string', format: 'uri' },
            owner: { type: 'string', format: 'objectId' },
            plan: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'] },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Task: {
          type: 'object',
          required: ['title', 'event'],
          properties: {
            _id: { type: 'string', format: 'objectId' },
            title: { type: 'string' },
            description: { type: 'string' },
            event: { type: 'string', format: 'objectId' },
            assignedTo: { type: 'string', format: 'objectId' },
            status: { type: 'string', enum: ['pending', 'in-progress', 'completed', 'overdue'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
            deadline: { type: 'string', format: 'date-time' }
          }
        },
        Order: {
          type: 'object',
          properties: {
            _id: { type: 'string', format: 'objectId' },
            event: { type: 'string', format: 'objectId' },
            buyer: { type: 'string', format: 'objectId' },
            totalAmount: { type: 'number' },
            quantity: { type: 'integer' },
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled', 'refunded'] },
            paymentMethod: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Category: {
          type: 'object',
          required: ['name'],
          properties: {
            _id: { type: 'string', format: 'objectId' },
            name: { type: 'string' },
            description: { type: 'string' },
            imageUrl: { type: 'string', format: 'uri' },
            isActive: { type: 'boolean' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: true },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: true },
            message: { type: 'string' },
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
                hasMore: { type: 'boolean' }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Validation failed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Events', description: 'Event management endpoints' },
      { name: 'Organizations', description: 'Organization management endpoints' },
      { name: 'Tasks', description: 'Task management endpoints' },
      { name: 'Orders', description: 'Order and payment endpoints' },
      { name: 'Categories', description: 'Category management endpoints' },
      { name: 'Chat', description: 'Real-time chat endpoints' },
      { name: 'Notifications', description: 'Push notification endpoints' }
    ]
  },
  apis: ['./routes/*.js', './routes/**/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
