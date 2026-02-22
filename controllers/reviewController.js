const Review = require('../models/review');
const Order = require('../models/order');
const Event = require('../models/event');
const { success, created, error, notFound, paginated, serverError } = require('../utils/responseHandler');

const createReview = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { rating, title, review, aspects, pros, cons, wouldRecommend, images } = req.body;
    
    // Check if event exists and has ended
    const event = await Event.findById(eventId);
    if (!event) {
      return notFound(res, 'Event not found');
    }
    
    if (new Date(event.endDateTime) > new Date()) {
      return error(res, 'You can only review events that have ended', 400);
    }
    
    // Check if user attended the event
    const order = await Order.findOne({
      event: eventId,
      buyer: req.user.userId,
      status: 'completed'
    });
    
    const isVerifiedAttendee = !!order;
    
    // Check for existing review
    const existingReview = await Review.findOne({
      event: eventId,
      user: req.user.userId,
      isDeleted: false
    });
    
    if (existingReview) {
      return error(res, 'You have already reviewed this event', 400);
    }
    
    const newReview = await Review.create({
      event: eventId,
      user: req.user.userId,
      rating,
      title,
      review,
      aspects,
      pros,
      cons,
      wouldRecommend,
      images,
      isVerifiedAttendee,
      organizationId: event.organizationId
    });
    
    await newReview.populate('user', 'firstName lastName avatar');
    
    return created(res, { review: newReview }, 'Review submitted successfully');
  } catch (err) {
    if (err.code === 11000) {
      return error(res, 'You have already reviewed this event', 400);
    }
    console.error('Create review error:', err);
    return serverError(res, 'Failed to create review');
  }
};

const getEventReviews = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      sort = 'recent',
      rating,
      verified 
    } = req.query;
    
    const query = {
      event: eventId,
      status: 'approved',
      isDeleted: false
    };
    
    if (rating) {
      query.rating = parseInt(rating);
    }
    
    if (verified === 'true') {
      query.isVerifiedAttendee = true;
    }
    
    let sortOption = { createdAt: -1 };
    switch (sort) {
      case 'highest':
        sortOption = { rating: -1, createdAt: -1 };
        break;
      case 'lowest':
        sortOption = { rating: 1, createdAt: -1 };
        break;
      case 'helpful':
        sortOption = { helpfulCount: -1, createdAt: -1 };
        break;
    }
    
    const reviews = await Review.find(query)
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'firstName lastName avatar')
      .populate('response.respondedBy', 'firstName lastName');
    
    const total = await Review.countDocuments(query);
    const stats = await Review.getEventStats(eventId);
    
    return success(res, {
      reviews,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get event reviews error:', err);
    return serverError(res, 'Failed to fetch reviews');
  }
};

const getReviewById = async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      status: 'approved',
      isDeleted: false
    })
      .populate('user', 'firstName lastName avatar')
      .populate('event', 'title startDateTime imageUrl')
      .populate('response.respondedBy', 'firstName lastName');
    
    if (!review) {
      return notFound(res, 'Review not found');
    }
    
    return success(res, { review });
  } catch (err) {
    console.error('Get review error:', err);
    return serverError(res, 'Failed to fetch review');
  }
};

const updateReview = async (req, res) => {
  try {
    const { rating, title, review, aspects, pros, cons, wouldRecommend, images } = req.body;
    
    const existingReview = await Review.findOne({
      _id: req.params.reviewId,
      user: req.user.userId,
      isDeleted: false
    });
    
    if (!existingReview) {
      return notFound(res, 'Review not found');
    }
    
    // Update fields
    if (rating !== undefined) existingReview.rating = rating;
    if (title !== undefined) existingReview.title = title;
    if (review !== undefined) existingReview.review = review;
    if (aspects !== undefined) existingReview.aspects = aspects;
    if (pros !== undefined) existingReview.pros = pros;
    if (cons !== undefined) existingReview.cons = cons;
    if (wouldRecommend !== undefined) existingReview.wouldRecommend = wouldRecommend;
    if (images !== undefined) existingReview.images = images;
    
    await existingReview.save();
    await existingReview.populate('user', 'firstName lastName avatar');
    
    return success(res, { review: existingReview }, 'Review updated successfully');
  } catch (err) {
    console.error('Update review error:', err);
    return serverError(res, 'Failed to update review');
  }
};

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findOneAndUpdate(
      {
        _id: req.params.reviewId,
        user: req.user.userId,
        isDeleted: false
      },
      { isDeleted: true },
      { new: true }
    );
    
    if (!review) {
      return notFound(res, 'Review not found');
    }
    
    return success(res, null, 'Review deleted successfully');
  } catch (err) {
    console.error('Delete review error:', err);
    return serverError(res, 'Failed to delete review');
  }
};

const markHelpful = async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      status: 'approved',
      isDeleted: false
    });
    
    if (!review) {
      return notFound(res, 'Review not found');
    }
    
    await review.markHelpful(req.user.userId);
    
    return success(res, { helpfulCount: review.helpfulCount }, 'Marked as helpful');
  } catch (err) {
    console.error('Mark helpful error:', err);
    return serverError(res, 'Failed to mark as helpful');
  }
};

const removeHelpful = async (req, res) => {
  try {
    const review = await Review.findOne({
      _id: req.params.reviewId,
      isDeleted: false
    });
    
    if (!review) {
      return notFound(res, 'Review not found');
    }
    
    await review.removeHelpfulVote(req.user.userId);
    
    return success(res, { helpfulCount: review.helpfulCount }, 'Helpful vote removed');
  } catch (err) {
    console.error('Remove helpful error:', err);
    return serverError(res, 'Failed to remove helpful vote');
  }
};

const reportReview = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const review = await Review.findOne({
      _id: req.params.reviewId,
      isDeleted: false
    });
    
    if (!review) {
      return notFound(res, 'Review not found');
    }
    
    // Check if already reported by this user
    const alreadyReported = review.reportedBy.some(
      r => r.user.toString() === req.user.userId.toString()
    );
    
    if (alreadyReported) {
      return error(res, 'You have already reported this review', 400);
    }
    
    review.reportedBy.push({
      user: req.user.userId,
      reason
    });
    
    // Auto-flag if reported by multiple users
    if (review.reportedBy.length >= 3) {
      review.status = 'flagged';
    }
    
    await review.save();
    
    return success(res, null, 'Review reported successfully');
  } catch (err) {
    console.error('Report review error:', err);
    return serverError(res, 'Failed to report review');
  }
};

const addOrganizerResponse = async (req, res) => {
  try {
    const { content } = req.body;
    
    const review = await Review.findById(req.params.reviewId)
      .populate('event', 'organizer');
    
    if (!review) {
      return notFound(res, 'Review not found');
    }
    
    // Check if user is the event organizer
    if (review.event.organizer.toString() !== req.user.userId.toString()) {
      return error(res, 'Only the event organizer can respond to reviews', 403);
    }
    
    review.response = {
      content,
      respondedBy: req.user.userId,
      respondedAt: new Date()
    };
    
    await review.save();
    await review.populate('response.respondedBy', 'firstName lastName');
    
    return success(res, { review }, 'Response added successfully');
  } catch (err) {
    console.error('Add organizer response error:', err);
    return serverError(res, 'Failed to add response');
  }
};

const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({
      user: req.user.userId,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .populate('event', 'title startDateTime imageUrl');
    
    return success(res, { reviews });
  } catch (err) {
    console.error('Get my reviews error:', err);
    return serverError(res, 'Failed to fetch your reviews');
  }
};

module.exports = {
  createReview,
  getEventReviews,
  getReviewById,
  updateReview,
  deleteReview,
  markHelpful,
  removeHelpful,
  reportReview,
  addOrganizerResponse,
  getMyReviews
};
