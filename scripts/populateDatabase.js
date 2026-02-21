const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/user');
const Event = require('../models/event');
const Category = require('../models/category');
const Order = require('../models/order');
const Task = require('../models/task');
const EventTemplate = require('../models/eventTemplate');

// Dummy data
const dummyUsers = [
  {
    firstName: 'John',
    lastName: 'Doe',
    username: 'johndoe',
    email: 'john.doe@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Jane',
    lastName: 'Smith',
    username: 'janesmith',
    email: 'jane.smith@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Mike',
    lastName: 'Johnson',
    username: 'mikejohnson',
    email: 'mike.johnson@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Sarah',
    lastName: 'Wilson',
    username: 'sarahwilson',
    email: 'sarah.wilson@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'David',
    lastName: 'Brown',
    username: 'davidbrown',
    email: 'david.brown@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Emily',
    lastName: 'Davis',
    username: 'emilydavis',
    email: 'emily.davis@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Alex',
    lastName: 'Miller',
    username: 'alexmiller',
    email: 'alex.miller@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Lisa',
    lastName: 'Garcia',
    username: 'lisagarcia',
    email: 'lisa.garcia@example.com',
    password: 'password123',
    role: 'user'
  },
  {
    firstName: 'Admin',
    lastName: 'User',
    username: 'admin',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin'
  },
  {
    firstName: 'Moderator',
    lastName: 'User',
    username: 'moderator',
    email: 'moderator@example.com',
    password: 'password123',
    role: 'moderator'
  }
];

const dummyCategories = [
  {
    name: 'Technology',
    description: 'Tech conferences, workshops, and meetups',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=500',
    isActive: true
  },
  {
    name: 'Business',
    description: 'Business networking, seminars, and conferences',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    isActive: true
  },
  {
    name: 'Music',
    description: 'Concerts, festivals, and music events',
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500',
    isActive: true
  },
  {
    name: 'Sports',
    description: 'Sports events, tournaments, and competitions',
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    isActive: true
  },
  {
    name: 'Education',
    description: 'Educational workshops, courses, and seminars',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500',
    isActive: true
  },
  {
    name: 'Art & Culture',
    description: 'Art exhibitions, cultural events, and performances',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=500',
    isActive: true
  },
  {
    name: 'Food & Drink',
    description: 'Food festivals, wine tastings, and culinary events',
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500',
    isActive: true
  },
  {
    name: 'Health & Wellness',
    description: 'Fitness events, wellness workshops, and health seminars',
    imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    isActive: true
  }
];

const eventTitles = [
  'Tech Innovation Summit 2024',
  'Digital Marketing Masterclass',
  'Jazz Night at the Garden',
  'Startup Pitch Competition',
  'Yoga & Meditation Retreat',
  'Food & Wine Festival',
  'AI & Machine Learning Workshop',
  'Photography Exhibition',
  'Business Networking Mixer',
  'Rock Concert Under the Stars',
  'Data Science Conference',
  'Art Gallery Opening',
  'Fitness Bootcamp',
  'Cooking Class: Italian Cuisine',
  'Blockchain Technology Seminar',
  'Music Festival 2024',
  'Entrepreneurship Workshop',
  'Wine Tasting Event',
  'Cybersecurity Summit',
  'Dance Performance Night',
  'Mobile App Development Course',
  'Cultural Heritage Exhibition',
  'Marathon Training Session',
  'Craft Beer Festival',
  'Cloud Computing Workshop',
  'Theater Performance',
  'CrossFit Competition',
  'Sushi Making Workshop',
  'IoT Innovation Conference',
  'Poetry Reading Night'
];

const locations = [
  'Convention Center, New York',
  'Tech Hub, San Francisco',
  'Music Hall, Los Angeles',
  'Business Center, Chicago',
  'Art Gallery, Miami',
  'Stadium, Boston',
  'Conference Room, Seattle',
  'Theater, Austin',
  'Park Pavilion, Denver',
  'Hotel Ballroom, Las Vegas',
  'University Campus, Portland',
  'Community Center, Phoenix',
  'Museum, Philadelphia',
  'Sports Complex, Dallas',
  'Cultural Center, Nashville'
];

const descriptions = [
  'Join us for an exciting event featuring industry experts, networking opportunities, and hands-on workshops.',
  'Discover the latest trends and innovations in this comprehensive event designed for professionals.',
  'An immersive experience that combines learning, networking, and entertainment in one place.',
  'Connect with like-minded individuals and expand your knowledge in this dynamic environment.',
  'Experience something new and exciting with our carefully curated program of activities.',
  'A unique opportunity to learn, grow, and connect with industry leaders and peers.',
  'Don\'t miss this exclusive event featuring top speakers and interactive sessions.',
  'Join us for a day of inspiration, learning, and meaningful connections.',
  'An event designed to inspire, educate, and connect professionals from various industries.',
  'Experience the future of innovation and technology in this groundbreaking event.'
];

// Helper functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomElements = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const generateRandomDate = (start, end) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
  return new Date(randomTime);
};

const generateEvent = (organizerId, categoryId) => {
  const startDate = generateRandomDate(new Date(), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
  const endDate = new Date(startDate.getTime() + (2 + Math.random() * 6) * 60 * 60 * 1000); // 2-8 hours duration
  
  const isFree = Math.random() < 0.3; // 30% chance of being free
  const price = isFree ? 0 : Math.floor(Math.random() * 200) + 10; // $10-$210
  
  return {
    title: getRandomElement(eventTitles),
    description: getRandomElement(descriptions),
    location: getRandomElement(locations),
    imageUrl: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000000)}?w=800&h=600&fit=crop`,
    startDateTime: startDate,
    endDateTime: endDate,
    price: price.toString(),
    isFree,
    url: `https://example.com/event-${Math.random().toString(36).substr(2, 9)}`,
    category: categoryId,
    organizer: organizerId,
    capacity: Math.floor(Math.random() * 200) + 50, // 50-250 capacity
    tags: getRandomElements(['networking', 'learning', 'fun', 'professional', 'creative', 'social', 'educational', 'entertainment'], 3),
    attendees: [],
    status: 'upcoming'
  };
};

const generateTask = (eventId, assigneeId) => {
  const taskTypes = ['Setup', 'Registration', 'Catering', 'Security', 'Cleanup', 'Marketing', 'Technical Support', 'Photography'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['pending', 'in-progress', 'completed', 'overdue'];
  
  return {
    title: `${getRandomElement(taskTypes)} Task`,
    description: `Handle ${getRandomElement(taskTypes).toLowerCase()} for the event`,
    event: eventId,
    assignedTo: assigneeId,
    priority: getRandomElement(priorities),
    status: getRandomElement(statuses),
    deadline: generateRandomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  };
};

const generateOrder = (userId, eventId, eventPrice) => {
  const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 tickets
  const totalAmount = eventPrice * quantity;
  
  return {
    buyer: userId,
    event: eventId,
    totalAmount: totalAmount.toString(),
    stripeId: `pi_${Math.random().toString(36).substr(2, 9)}`
  };
};

const clearDatabase = async () => {
  console.log('🗑️  Clearing database...');
  await User.deleteMany({});
  await Event.deleteMany({});
  await Category.deleteMany({});
  await Order.deleteMany({});
  await Task.deleteMany({});
  await EventTemplate.deleteMany({});
  console.log('✅ Database cleared');
};

const populateDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📡 Connected to MongoDB');

    // Clear existing data
    await clearDatabase();

    // Create categories
    console.log('📂 Creating categories...');
    const categories = await Category.insertMany(dummyCategories);
    console.log(`✅ Created ${categories.length} categories`);

    // Create users
    console.log('👥 Creating users...');
    const hashedUsers = await Promise.all(
      dummyUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 10)
      }))
    );
    const users = await User.insertMany(hashedUsers);
    console.log(`✅ Created ${users.length} users`);

    // Create events
    console.log('🎉 Creating events...');
    const events = [];
    const organizers = users.filter(user => user.role === 'user' || user.role === 'admin');
    
    for (let i = 0; i < 50; i++) {
      const organizer = getRandomElement(organizers);
      const category = getRandomElement(categories);
      const event = generateEvent(organizer._id, category._id);
      events.push(event);
    }
    
    const createdEvents = await Event.insertMany(events);
    console.log(`✅ Created ${createdEvents.length} events`);

    // Add attendees to events
    console.log('👥 Adding attendees to events...');
    const attendees = users.filter(user => user.role === 'user');
    
    for (const event of createdEvents) {
      const numAttendees = Math.floor(Math.random() * Math.min(event.capacity, 20));
      const eventAttendees = getRandomElements(attendees, numAttendees);
      event.attendees = eventAttendees.map(attendee => attendee._id);
      await event.save();
    }
    console.log('✅ Added attendees to events');

    // Create orders
    console.log('🎫 Creating orders...');
    const orders = [];
    
    for (let i = 0; i < 100; i++) {
      const user = getRandomElement(users);
      const event = getRandomElement(createdEvents);
      const order = generateOrder(user._id, event._id, parseFloat(event.price));
      orders.push(order);
    }
    
    const createdOrders = await Order.insertMany(orders);
    console.log(`✅ Created ${createdOrders.length} orders`);

    // Create tasks
    console.log('📋 Creating tasks...');
    const tasks = [];
    
    for (let i = 0; i < 80; i++) {
      const event = getRandomElement(createdEvents);
      const assignee = getRandomElement(users);
      const task = generateTask(event._id, assignee._id);
      tasks.push(task);
    }
    
    const createdTasks = await Task.insertMany(tasks);
    console.log(`✅ Created ${createdTasks.length} tasks`);

    // Create event templates
    console.log('📄 Creating event templates...');
    const templates = [
      {
        name: 'Tech Conference Template',
        description: 'A comprehensive template for technology conferences',
        category: categories.find(c => c.name === 'Technology')._id,
        templateData: {
          title: 'Tech Conference',
          description: 'Join us for an exciting technology conference',
          location: 'Convention Center',
          capacity: 200,
          tags: ['technology', 'conference', 'networking']
        },
        isPublic: true
      },
      {
        name: 'Music Festival Template',
        description: 'Template for music festivals and concerts',
        category: categories.find(c => c.name === 'Music')._id,
        templateData: {
          title: 'Music Festival',
          description: 'Experience amazing music and performances',
          location: 'Outdoor Venue',
          capacity: 1000,
          tags: ['music', 'festival', 'entertainment']
        },
        isPublic: true
      },
      {
        name: 'Workshop Template',
        description: 'Template for educational workshops',
        category: categories.find(c => c.name === 'Education')._id,
        templateData: {
          title: 'Educational Workshop',
          description: 'Learn new skills in this hands-on workshop',
          location: 'Training Center',
          capacity: 50,
          tags: ['education', 'workshop', 'learning']
        },
        isPublic: true
      }
    ];
    
    const createdTemplates = await EventTemplate.insertMany(templates);
    console.log(`✅ Created ${createdTemplates.length} event templates`);

    // Generate summary
    console.log('\n🎉 Database population completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   📂 Categories: ${categories.length}`);
    console.log(`   🎉 Events: ${createdEvents.length}`);
    console.log(`   🎫 Orders: ${createdOrders.length}`);
    console.log(`   📋 Tasks: ${createdTasks.length}`);
    console.log(`   📄 Templates: ${createdTemplates.length}`);

    // Create reference JSON file
    const referenceData = {
      users: users.map(user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      })),
      categories: categories.map(cat => ({
        _id: cat._id,
        name: cat.name,
        description: cat.description
      })),
      events: createdEvents.map(event => ({
        _id: event._id,
        title: event.title,
        organizer: event.organizer,
        category: event.category,
        startDateTime: event.startDateTime,
        price: event.price,
        isFree: event.isFree
      })),
      orders: createdOrders.map(order => ({
        _id: order._id,
        user: order.user,
        event: order.event,
        totalAmount: order.totalAmount
      })),
      tasks: createdTasks.map(task => ({
        _id: task._id,
        title: task.title,
        event: task.event,
        assignee: task.assignee,
        status: task.status
      })),
      templates: createdTemplates.map(template => ({
        _id: template._id,
        name: template.name,
        category: template.category
      }))
    };

    const fs = require('fs');
    fs.writeFileSync('dummy_data_reference.json', JSON.stringify(referenceData, null, 2));
    console.log('📄 Reference data saved to dummy_data_reference.json');

  } catch (error) {
    console.error('❌ Error populating database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
};

// Run the script
populateDatabase();