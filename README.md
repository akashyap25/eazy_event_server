# Eazy Event Server

Backend API for the Eazy Event platform - a comprehensive event management system.

## Features

- **Authentication**: JWT-based auth with access & refresh tokens
- **Event Management**: Full CRUD operations with validation
- **Task Management**: Create and assign tasks to events
- **Calendar Export**: iCal, Google Calendar, Outlook, Yahoo integration
- **Categories**: Organize events by categories
- **Orders & Payments**: Stripe integration for ticket purchases
- **Real-time**: Socket.IO for live chat and notifications
- **Analytics**: Event performance tracking

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken, bcryptjs)
- **Validation**: express-validator
- **File Upload**: Cloudinary
- **Payments**: Stripe
- **Email**: Nodemailer
- **Calendar**: ical-generator

## Quick Start

### Prerequisites

- Node.js (v16+)
- MongoDB instance
- Cloudinary account
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/akashyap25/eazy_event_server.git
cd eazy_event_server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start the server
npm start
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
STRIPE_SECRET_KEY=your_stripe_secret
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/users/register` | Register new user |
| POST | `/api/users/login` | Login user |
| POST | `/api/users/refresh-token` | Refresh access token |
| GET | `/api/users/me` | Get current user profile |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Get all events |
| GET | `/api/events/:id` | Get event by ID |
| POST | `/api/events/create` | Create new event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| POST | `/api/events/:id/register` | Register for event |
| POST | `/api/events/:id/unregister` | Unregister from event |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks/event/:eventId` | Get tasks by event |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | Get all categories |
| POST | `/api/categories` | Create category |

### Calendar Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/calendar-export/:eventId/ical` | Export as iCal |
| GET | `/api/calendar-export/:eventId/google` | Google Calendar link |
| GET | `/api/calendar-export/:eventId/outlook` | Outlook link |

### Event Chat (Socket.IO + REST)
Real-time chat for events. Only event owner, collaborators, and registered attendees can join and send messages. Messages are persisted in MongoDB.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/events/:eventId/rooms` | Get chat rooms for event (auth required) |
| POST | `/api/chat/events/:eventId/rooms` | Find or create event chat room (auth required) |
| GET | `/api/chat/rooms/:roomId/messages` | Get message history (auth + participant required) |

**Socket.IO:** Connect with `auth: { token: accessToken }`. Events: `join_room` (payload: `{ roomId, displayName }`), `send_message` (payload: `{ roomId, content }`). Messages include `senderEventRole`: `owner` \| `collaborator` \| `attendee`.

## Project Structure

```
eazy_event_server/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── db/               # Database connection
├── middlewares/      # Express middlewares
├── models/           # Mongoose models
├── routes/           # API routes
├── services/         # Business logic
├── utils/            # Utility functions
├── tests/            # Test files
├── app.js            # Express app entry
└── package.json
```

## Testing

```bash
# Run tests
npm test
```

## Related

- **Frontend**: [Eazy_Event](https://github.com/akashyap25/Eazy_Event) - React frontend for this API

## License

MIT
