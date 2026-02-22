const aiService = require('../services/aiService');
const Event = require('../models/event');
const { success, error, serverError } = require('../utils/responseHandler');

const generateDescription = async (req, res) => {
  try {
    const { title, category, location, startDateTime, endDateTime, targetAudience } = req.body;
    
    if (!title) {
      return error(res, 'Event title is required', 400);
    }

    const description = await aiService.generateEventDescription({
      title,
      category,
      location,
      startDateTime,
      endDateTime,
      targetAudience
    });

    return success(res, { description }, 'Description generated successfully');
  } catch (err) {
    console.error('Generate description error:', err);
    return serverError(res, err.message || 'Failed to generate description');
  }
};

const generateTags = async (req, res) => {
  try {
    const { title, description, category } = req.body;
    
    if (!title) {
      return error(res, 'Event title is required', 400);
    }

    const tags = await aiService.generateEventTags({
      title,
      description,
      category
    });

    return success(res, { tags }, 'Tags generated successfully');
  } catch (err) {
    console.error('Generate tags error:', err);
    return serverError(res, err.message || 'Failed to generate tags');
  }
};

const generateTaskBreakdown = async (req, res) => {
  try {
    const { title, description, startDateTime, category } = req.body;
    
    if (!title) {
      return error(res, 'Event title is required', 400);
    }

    const tasks = await aiService.generateTaskBreakdown({
      title,
      description,
      startDateTime,
      category
    });

    return success(res, { tasks }, 'Task breakdown generated successfully');
  } catch (err) {
    console.error('Generate task breakdown error:', err);
    return serverError(res, err.message || 'Failed to generate task breakdown');
  }
};

const suggestTitles = async (req, res) => {
  try {
    const { keywords, category } = req.body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return error(res, 'Keywords array is required', 400);
    }

    const titles = await aiService.suggestEventTitle(keywords, category);

    return success(res, { titles }, 'Titles suggested successfully');
  } catch (err) {
    console.error('Suggest titles error:', err);
    return serverError(res, err.message || 'Failed to suggest titles');
  }
};

const improveText = async (req, res) => {
  try {
    const { text, context } = req.body;
    
    if (!text) {
      return error(res, 'Text is required', 400);
    }

    const improvedText = await aiService.improveText(text, context);

    return success(res, { improvedText }, 'Text improved successfully');
  } catch (err) {
    console.error('Improve text error:', err);
    return serverError(res, err.message || 'Failed to improve text');
  }
};

const generateSocialPost = async (req, res) => {
  try {
    const { eventId, platform } = req.body;
    
    if (!eventId) {
      return error(res, 'Event ID is required', 400);
    }

    const event = await Event.findById(eventId).populate('category');
    if (!event) {
      return error(res, 'Event not found', 404);
    }

    const post = await aiService.generateSocialMediaPost({
      title: event.title,
      description: event.description,
      startDateTime: event.startDateTime,
      location: event.location
    }, platform);

    return success(res, { post, platform: platform || 'general' }, 'Social media post generated successfully');
  } catch (err) {
    console.error('Generate social post error:', err);
    return serverError(res, err.message || 'Failed to generate social post');
  }
};

const answerQuestion = async (req, res) => {
  try {
    const { eventId, question } = req.body;
    
    if (!eventId || !question) {
      return error(res, 'Event ID and question are required', 400);
    }

    const event = await Event.findById(eventId).populate('category');
    if (!event) {
      return error(res, 'Event not found', 404);
    }

    const answer = await aiService.answerEventQuestion(question, {
      title: event.title,
      description: event.description,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      location: event.location,
      price: event.price,
      category: event.category?.name
    });

    return success(res, { answer }, 'Question answered successfully');
  } catch (err) {
    console.error('Answer question error:', err);
    return serverError(res, err.message || 'Failed to answer question');
  }
};

const analyzeReviews = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return error(res, 'Event not found', 404);
    }

    // Fetch reviews for this event (placeholder - implement when review model is ready)
    const reviews = []; // await Review.find({ event: eventId });
    
    const sentiment = await aiService.analyzeEventSentiment(reviews);

    return success(res, { sentiment }, 'Sentiment analysis completed');
  } catch (err) {
    console.error('Analyze reviews error:', err);
    return serverError(res, err.message || 'Failed to analyze reviews');
  }
};

const getRecommendations = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    // Get user preferences (placeholder - would come from user profile)
    const userPreferences = {
      interests: req.body.interests || [],
      pastEvents: req.body.pastEvents || [],
      location: req.body.location
    };

    // Get available events
    const availableEvents = await Event.find({
      startDateTime: { $gte: new Date() },
      isDeleted: { $ne: true }
    }).populate('category').limit(20);

    const recommendedIds = await aiService.recommendEvents(userPreferences, availableEvents);
    
    // Fetch recommended events
    const recommendations = await Event.find({
      _id: { $in: recommendedIds }
    }).populate('category').populate('organizer', 'firstName lastName');

    return success(res, { recommendations }, 'Recommendations generated successfully');
  } catch (err) {
    console.error('Get recommendations error:', err);
    return serverError(res, err.message || 'Failed to get recommendations');
  }
};

module.exports = {
  generateDescription,
  generateTags,
  generateTaskBreakdown,
  suggestTitles,
  improveText,
  generateSocialPost,
  answerQuestion,
  analyzeReviews,
  getRecommendations
};
