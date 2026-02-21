const request = require('supertest');
const app = require('../app');
const Event = require('../models/event');
const User = require('../models/user');

// Mock data
const mockEvent = {
  title: 'Test Event',
  description: 'This is a test event description',
  location: 'Test Location',
  imageUrl: 'https://example.com/image.jpg',
  startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  endDateTime: new Date(Date.now() + 25 * 60 * 60 * 1000), // Tomorrow + 1 hour
  price: '100',
  isFree: false,
  url: 'https://example.com/event',
  capacity: 50,
  tags: ['test', 'event']
};

const mockUser = {
  clerkId: 'test-clerk-id',
  email: 'test@example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  photo: 'https://example.com/photo.jpg'
};

describe('Event API', () => {
  beforeEach(async () => {
    // Clear database before each test
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Close database connection
    await Event.deleteMany({});
    await User.deleteMany({});
  });

  describe('GET /api/events', () => {
    it('should get all events', async () => {
      // Create a test event
      const user = await User.create(mockUser);
      const event = await Event.create({
        ...mockEvent,
        organizer: user._id,
        category: new require('mongoose').Types.ObjectId()
      });

      const response = await request(app)
        .get('/api/events')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe(mockEvent.title);
    });

    it('should filter events by status', async () => {
      const user = await User.create(mockUser);
      const event = await Event.create({
        ...mockEvent,
        organizer: user._id,
        category: new require('mongoose').Types.ObjectId(),
        status: 'upcoming'
      });

      const response = await request(app)
        .get('/api/events?status=upcoming')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('upcoming');
    });
  });

  describe('GET /api/events/:id', () => {
    it('should get event by id', async () => {
      const user = await User.create(mockUser);
      const event = await Event.create({
        ...mockEvent,
        organizer: user._id,
        category: new require('mongoose').Types.ObjectId()
      });

      const response = await request(app)
        .get(`/api/events/${event._id}`)
        .expect(200);

      expect(response.body.title).toBe(mockEvent.title);
      expect(response.body.description).toBe(mockEvent.description);
    });

    it('should return 404 for non-existent event', async () => {
      const nonExistentId = new require('mongoose').Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/events/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Event not found');
    });
  });

  describe('POST /api/events/create', () => {
    it('should create a new event with valid data', async () => {
      const user = await User.create(mockUser);
      const categoryId = new require('mongoose').Types.ObjectId();

      const response = await request(app)
        .post('/api/events/create')
        .send({
          ...mockEvent,
          category: categoryId
        })
        .set('Authorization', `Bearer mock-token`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.eventId).toBeDefined();
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/events/create')
        .send({
          title: '', // Invalid: empty title
          description: 'Test description'
        })
        .set('Authorization', `Bearer mock-token`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
    });
  });
});