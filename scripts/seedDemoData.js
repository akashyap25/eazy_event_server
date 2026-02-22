const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/user');
const Organization = require('../models/organization');
const OrganizationMember = require('../models/organizationMember');
const Category = require('../models/category');
const Event = require('../models/event');
const Order = require('../models/order');
const Task = require('../models/task');
const FAQ = require('../models/faq');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/eazy_event';

const categories = [
  { name: 'Technology', description: 'Tech meetups, hackathons, and coding events', isGlobal: true },
  { name: 'Business', description: 'Networking events, conferences, and workshops', isGlobal: true },
  { name: 'Music', description: 'Concerts, festivals, and music workshops', isGlobal: true },
  { name: 'Sports', description: 'Sports events, tournaments, and fitness activities', isGlobal: true },
  { name: 'Arts & Culture', description: 'Art exhibitions, theater, and cultural events', isGlobal: true },
  { name: 'Education', description: 'Seminars, training, and educational workshops', isGlobal: true },
  { name: 'Food & Drink', description: 'Food festivals, wine tastings, and culinary events', isGlobal: true },
  { name: 'Health & Wellness', description: 'Yoga, meditation, and wellness retreats', isGlobal: true },
  { name: 'Community', description: 'Local community gatherings and social events', isGlobal: true },
  { name: 'Charity', description: 'Fundraisers and charitable events', isGlobal: true }
];

const demoUsers = [
  {
    email: 'admin@demo.com',
    password: 'Demo@123!',
    username: 'admin_demo',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isEmailVerified: true,
    authProvider: 'local'
  },
  {
    email: 'orgadmin@demo.com',
    password: 'Demo@123!',
    username: 'org_admin',
    firstName: 'Organization',
    lastName: 'Admin',
    role: 'user',
    isEmailVerified: true,
    authProvider: 'local'
  },
  {
    email: 'manager@demo.com',
    password: 'Demo@123!',
    username: 'event_manager',
    firstName: 'Event',
    lastName: 'Manager',
    role: 'user',
    isEmailVerified: true,
    authProvider: 'local'
  },
  {
    email: 'user@demo.com',
    password: 'Demo@123!',
    username: 'regular_user',
    firstName: 'Regular',
    lastName: 'User',
    role: 'user',
    isEmailVerified: true,
    authProvider: 'local'
  },
  {
    email: 'attendee@demo.com',
    password: 'Demo@123!',
    username: 'event_attendee',
    firstName: 'Event',
    lastName: 'Attendee',
    role: 'user',
    isEmailVerified: true,
    authProvider: 'local'
  }
];

const demoOrganizations = [
  {
    name: 'Tech Meetups Inc',
    slug: 'tech-meetups',
    description: 'Organizing technology events and meetups for developers and tech enthusiasts',
    plan: 'pro',
    settings: {
      branding: { primaryColor: '#3B82F6', secondaryColor: '#1E40AF' },
      limits: { maxEvents: 50, maxMembers: 100 }
    }
  },
  {
    name: 'Community Events Hub',
    slug: 'community-hub',
    description: 'Bringing communities together through local events and gatherings',
    plan: 'free',
    settings: {
      branding: { primaryColor: '#10B981', secondaryColor: '#047857' },
      limits: { maxEvents: 10, maxMembers: 20 }
    }
  },
  {
    name: 'Corporate Training Co',
    slug: 'corporate-training',
    description: 'Professional training and corporate event management',
    plan: 'enterprise',
    settings: {
      branding: { primaryColor: '#8B5CF6', secondaryColor: '#6D28D9' },
      limits: { maxEvents: 200, maxMembers: 500 }
    }
  }
];

const faqs = [
  {
    question: 'How do I create an event?',
    answer: 'To create an event, log in to your account, click on "Create Event" in the navigation bar, fill in the event details including title, description, date, time, location, and ticket information, then click "Publish" to make your event live.',
    category: 'events',
    isGlobal: true
  },
  {
    question: 'How do I register for an event?',
    answer: 'Find the event you want to attend, click on it to view details, and click the "Register" or "Buy Tickets" button. Follow the prompts to complete your registration or payment.',
    category: 'attendees',
    isGlobal: true
  },
  {
    question: 'Can I get a refund for my ticket?',
    answer: 'Refund policies vary by event. Please check the specific event\'s refund policy or contact the event organizer directly. Generally, refunds must be requested at least 48 hours before the event.',
    category: 'payments',
    isGlobal: true
  },
  {
    question: 'How do I contact the event organizer?',
    answer: 'On the event page, you can find the organizer\'s contact information or use the "Contact Organizer" button to send them a message directly through our platform.',
    category: 'general',
    isGlobal: true
  },
  {
    question: 'How do I check in at an event?',
    answer: 'Show your QR code ticket at the event entrance. The organizer will scan it to check you in. You can find your QR code in the "My Tickets" section of your account.',
    category: 'attendees',
    isGlobal: true
  },
  {
    question: 'How do I add team members to my organization?',
    answer: 'Go to your Organization Settings, click on "Members", then "Invite Member". Enter their email address and select their role. They will receive an invitation email to join your organization.',
    category: 'organizers',
    isGlobal: true
  }
];

const generateEvents = (users, categories, organizations) => {
  const now = new Date();
  const events = [];
  
  const eventTemplates = [
    {
      title: 'Web Development Workshop 2026',
      description: 'Learn modern web development with React, Node.js, and MongoDB. This hands-on workshop covers everything from basics to advanced concepts.',
      categoryIndex: 0,
      price: 499,
      isFree: false
    },
    {
      title: 'Startup Networking Mixer',
      description: 'Connect with fellow entrepreneurs, investors, and industry experts. Great opportunity to pitch your ideas and find potential partners.',
      categoryIndex: 1,
      price: 0,
      isFree: true
    },
    {
      title: 'AI & Machine Learning Summit',
      description: 'Explore the latest trends in artificial intelligence and machine learning. Featuring talks from industry leaders and hands-on demos.',
      categoryIndex: 0,
      price: 1999,
      isFree: false
    },
    {
      title: 'Community Yoga in the Park',
      description: 'Join us for a relaxing morning yoga session in the park. All skill levels welcome. Bring your own mat.',
      categoryIndex: 7,
      price: 0,
      isFree: true
    },
    {
      title: 'Food & Wine Festival',
      description: 'Sample delicious cuisines from local restaurants and enjoy fine wines from regional vineyards. Live music and entertainment included.',
      categoryIndex: 6,
      price: 799,
      isFree: false
    },
    {
      title: 'Digital Marketing Bootcamp',
      description: 'Master SEO, social media marketing, and content strategy in this intensive one-day bootcamp.',
      categoryIndex: 5,
      price: 1499,
      isFree: false
    },
    {
      title: 'Charity Run for Education',
      description: 'Run for a cause! All proceeds go to supporting underprivileged children\'s education.',
      categoryIndex: 9,
      price: 300,
      isFree: false
    },
    {
      title: 'Live Jazz Night',
      description: 'Enjoy an evening of smooth jazz with local and international artists. Drinks and appetizers available.',
      categoryIndex: 2,
      price: 599,
      isFree: false
    }
  ];
  
  eventTemplates.forEach((template, index) => {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + (index * 7) + Math.floor(Math.random() * 30));
    startDate.setHours(10 + Math.floor(Math.random() * 8), 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 3 + Math.floor(Math.random() * 5));
    
    events.push({
      title: template.title,
      description: template.description,
      location: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'][index % 5],
      startDateTime: startDate,
      endDateTime: endDate,
      price: template.price,
      isFree: template.isFree,
      category: categories[template.categoryIndex]._id,
      organizer: users[index % 3]._id,
      organizationId: organizations[index % 3]._id,
      visibility: index % 3 === 0 ? 'public' : 'organization',
      imageUrl: `https://picsum.photos/seed/event${index}/800/400`
    });
  });
  
  return events;
};

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Clear existing data (optional - comment out if you want to preserve data)
    console.log('Clearing existing demo data...');
    await User.deleteMany({ email: { $regex: /@demo\.com$/ } });
    await Organization.deleteMany({ slug: { $in: demoOrganizations.map(o => o.slug) } });
    await Category.deleteMany({ isGlobal: true });
    await FAQ.deleteMany({ isGlobal: true });
    
    // Create categories
    console.log('Creating categories...');
    const createdCategories = await Category.insertMany(categories);
    console.log(`Created ${createdCategories.length} categories`);
    
    // Create users
    console.log('Creating demo users...');
    const createdUsers = [];
    for (const userData of demoUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = await User.create({
        ...userData,
        password: hashedPassword
      });
      createdUsers.push(user);
    }
    console.log(`Created ${createdUsers.length} demo users`);
    
    // Create organizations
    console.log('Creating organizations...');
    const createdOrgs = [];
    for (let i = 0; i < demoOrganizations.length; i++) {
      const org = await Organization.create({
        ...demoOrganizations[i],
        owner: createdUsers[i + 1]._id
      });
      
      // Add owner as member
      await OrganizationMember.create({
        user: createdUsers[i + 1]._id,
        organization: org._id,
        role: 'owner',
        status: 'active'
      });
      
      createdOrgs.push(org);
    }
    console.log(`Created ${createdOrgs.length} organizations`);
    
    // Create events
    console.log('Creating events...');
    const eventData = generateEvents(createdUsers.slice(1), createdCategories, createdOrgs);
    const createdEvents = await Event.insertMany(eventData);
    console.log(`Created ${createdEvents.length} events`);
    
    // Create sample orders
    console.log('Creating sample orders...');
    const orders = [];
    for (let i = 0; i < 5; i++) {
      const event = createdEvents[i];
      if (!event.isFree) {
        orders.push({
          event: event._id,
          buyer: createdUsers[3]._id,
          totalAmount: event.price,
          status: 'completed',
          organizationId: event.organizationId
        });
      }
    }
    if (orders.length > 0) {
      await Order.insertMany(orders);
      console.log(`Created ${orders.length} sample orders`);
    }
    
    // Create tasks
    console.log('Creating sample tasks...');
    const tasks = [];
    for (let i = 0; i < 3; i++) {
      const event = createdEvents[i];
      tasks.push(
        {
          title: 'Venue Setup',
          description: 'Set up chairs, tables, and AV equipment',
          event: event._id,
          assignedTo: createdUsers[2]._id,
          createdBy: createdUsers[1]._id,
          organizationId: event.organizationId,
          status: 'pending',
          priority: 'high',
          deadline: new Date(event.startDateTime.getTime() - 24 * 60 * 60 * 1000)
        },
        {
          title: 'Send Reminder Emails',
          description: 'Send reminder emails to all registered attendees',
          event: event._id,
          assignedTo: createdUsers[2]._id,
          createdBy: createdUsers[1]._id,
          organizationId: event.organizationId,
          status: 'pending',
          priority: 'medium',
          deadline: new Date(event.startDateTime.getTime() - 48 * 60 * 60 * 1000)
        }
      );
    }
    await Task.insertMany(tasks);
    console.log(`Created ${tasks.length} sample tasks`);
    
    // Create FAQs
    console.log('Creating FAQs...');
    const createdFAQs = await FAQ.insertMany(faqs.map((faq, index) => ({
      ...faq,
      order: index,
      createdBy: createdUsers[0]._id
    })));
    console.log(`Created ${createdFAQs.length} FAQs`);
    
    console.log('\n========================================');
    console.log('Demo data seeded successfully!');
    console.log('========================================\n');
    console.log('Demo Accounts:');
    console.log('----------------------------------------');
    demoUsers.forEach(user => {
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Role: ${user.role === 'admin' ? 'Platform Admin' : 'Regular User'}`);
      console.log('----------------------------------------');
    });
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the seed script
seedDatabase();
