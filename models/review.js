const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  review: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  aspects: {
    venue: { type: Number, min: 1, max: 5 },
    organization: { type: Number, min: 1, max: 5 },
    content: { type: Number, min: 1, max: 5 },
    valueForMoney: { type: Number, min: 1, max: 5 },
    networking: { type: Number, min: 1, max: 5 }
  },
  pros: [String],
  cons: [String],
  wouldRecommend: {
    type: Boolean,
    default: true
  },
  images: [{
    url: String,
    caption: String
  }],
  helpfulVotes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    votedAt: { type: Date, default: Date.now }
  }],
  helpfulCount: {
    type: Number,
    default: 0
  },
  reportedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    reportedAt: { type: Date, default: Date.now }
  }],
  response: {
    content: String,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date
  },
  isVerifiedAttendee: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Compound unique index - one review per user per event
reviewSchema.index({ event: 1, user: 1 }, { unique: true });
reviewSchema.index({ event: 1, status: 1, createdAt: -1 });
reviewSchema.index({ rating: 1 });

// Virtual for average aspect rating
reviewSchema.virtual('averageAspectRating').get(function() {
  if (!this.aspects) return null;
  const values = Object.values(this.aspects).filter(v => v != null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
});

// Method to mark helpful
reviewSchema.methods.markHelpful = async function(userId) {
  const existingVote = this.helpfulVotes.find(
    v => v.user.toString() === userId.toString()
  );
  
  if (!existingVote) {
    this.helpfulVotes.push({ user: userId });
    this.helpfulCount += 1;
    return this.save();
  }
  return this;
};

// Method to remove helpful vote
reviewSchema.methods.removeHelpfulVote = async function(userId) {
  const voteIndex = this.helpfulVotes.findIndex(
    v => v.user.toString() === userId.toString()
  );
  
  if (voteIndex !== -1) {
    this.helpfulVotes.splice(voteIndex, 1);
    this.helpfulCount = Math.max(0, this.helpfulCount - 1);
    return this.save();
  }
  return this;
};

// Static method for event rating stats
reviewSchema.statics.getEventStats = async function(eventId) {
  const stats = await this.aggregate([
    { 
      $match: { 
        event: new mongoose.Types.ObjectId(eventId),
        status: 'approved',
        isDeleted: false 
      } 
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        },
        recommendPercentage: {
          $avg: { $cond: ['$wouldRecommend', 100, 0] }
        },
        avgVenue: { $avg: '$aspects.venue' },
        avgOrganization: { $avg: '$aspects.organization' },
        avgContent: { $avg: '$aspects.content' },
        avgValueForMoney: { $avg: '$aspects.valueForMoney' },
        avgNetworking: { $avg: '$aspects.networking' }
      }
    },
    {
      $project: {
        _id: 0,
        averageRating: { $round: ['$averageRating', 1] },
        totalReviews: 1,
        recommendPercentage: { $round: ['$recommendPercentage', 0] },
        aspectAverages: {
          venue: { $round: ['$avgVenue', 1] },
          organization: { $round: ['$avgOrganization', 1] },
          content: { $round: ['$avgContent', 1] },
          valueForMoney: { $round: ['$avgValueForMoney', 1] },
          networking: { $round: ['$avgNetworking', 1] }
        },
        ratingDistribution: 1
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      recommendPercentage: 0,
      aspectAverages: {},
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }
  
  // Calculate rating distribution
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stats[0].ratingDistribution.forEach(r => distribution[r]++);
  stats[0].ratingDistribution = distribution;
  
  return stats[0];
};

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
