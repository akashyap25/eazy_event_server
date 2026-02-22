const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  answer: {
    type: String,
    required: true,
    maxlength: 5000
  },
  category: {
    type: String,
    enum: ['general', 'events', 'payments', 'account', 'technical', 'organizers', 'attendees', 'other'],
    default: 'general'
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null
  },
  isGlobal: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  tags: [String],
  helpfulCount: {
    type: Number,
    default: 0
  },
  notHelpfulCount: {
    type: Number,
    default: 0
  },
  helpfulVotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    helpful: Boolean,
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],
  relatedFaqs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FAQ'
  }],
  viewCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Indexes
faqSchema.index({ category: 1, isPublished: 1, order: 1 });
faqSchema.index({ organizationId: 1, isPublished: 1 });
faqSchema.index({ tags: 1 });
faqSchema.index({ question: 'text', answer: 'text' });

// Virtual for helpfulness score
faqSchema.virtual('helpfulnessScore').get(function() {
  const total = this.helpfulCount + this.notHelpfulCount;
  if (total === 0) return 0;
  return (this.helpfulCount / total) * 100;
});

// Method to record vote
faqSchema.methods.recordVote = async function(userId, helpful) {
  const existingVoteIndex = this.helpfulVotes.findIndex(
    v => v.user.toString() === userId.toString()
  );
  
  if (existingVoteIndex !== -1) {
    const existingVote = this.helpfulVotes[existingVoteIndex];
    
    // Remove old vote count
    if (existingVote.helpful) {
      this.helpfulCount = Math.max(0, this.helpfulCount - 1);
    } else {
      this.notHelpfulCount = Math.max(0, this.notHelpfulCount - 1);
    }
    
    // Update vote
    this.helpfulVotes[existingVoteIndex] = {
      user: userId,
      helpful,
      votedAt: new Date()
    };
  } else {
    this.helpfulVotes.push({
      user: userId,
      helpful,
      votedAt: new Date()
    });
  }
  
  // Add new vote count
  if (helpful) {
    this.helpfulCount += 1;
  } else {
    this.notHelpfulCount += 1;
  }
  
  return this.save();
};

// Method to increment view
faqSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

// Static method to get by category
faqSchema.statics.getByCategory = function(category, organizationId = null) {
  const query = {
    isPublished: true,
    isDeleted: false,
    category
  };
  
  if (organizationId) {
    query.$or = [
      { organizationId },
      { isGlobal: true }
    ];
  } else {
    query.isGlobal = true;
  }
  
  return this.find(query).sort({ order: 1 });
};

// Static method for search
faqSchema.statics.search = function(searchQuery, organizationId = null) {
  const query = {
    isPublished: true,
    isDeleted: false,
    $text: { $search: searchQuery }
  };
  
  if (organizationId) {
    query.$or = [
      { organizationId },
      { isGlobal: true }
    ];
  } else {
    query.isGlobal = true;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(10);
};

// Static method to get popular FAQs
faqSchema.statics.getPopular = function(limit = 10, organizationId = null) {
  const query = {
    isPublished: true,
    isDeleted: false
  };
  
  if (organizationId) {
    query.$or = [
      { organizationId },
      { isGlobal: true }
    ];
  } else {
    query.isGlobal = true;
  }
  
  return this.find(query)
    .sort({ viewCount: -1, helpfulCount: -1 })
    .limit(limit);
};

const FAQ = mongoose.model('FAQ', faqSchema);
module.exports = FAQ;
