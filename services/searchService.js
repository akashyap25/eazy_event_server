const Event = require('../models/event');
const Category = require('../models/category');
const mongoose = require('mongoose');

class SearchService {
  /**
   * Search events with various filters
   */
  static async searchEvents(options = {}) {
    const {
      query,
      category,
      organizationId,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      location,
      status,
      visibility = 'public',
      tags,
      isFree,
      sortBy = 'relevance',
      page = 1,
      limit = 20,
      userId // For personalized results
    } = options;

    const matchStage = {
      isDeleted: { $ne: true }
    };

    // Text search
    if (query && query.trim()) {
      matchStage.$text = { $search: query };
    }

    // Category filter
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        matchStage.category = new mongoose.Types.ObjectId(category);
      } else {
        // Search by category name
        const cat = await Category.findOne({ 
          name: { $regex: category, $options: 'i' },
          isDeleted: { $ne: true }
        });
        if (cat) matchStage.category = cat._id;
      }
    }

    // Organization filter
    if (organizationId) {
      matchStage.organizationId = new mongoose.Types.ObjectId(organizationId);
    }

    // Visibility filter
    if (visibility === 'public') {
      matchStage.visibility = 'public';
    } else if (visibility === 'organization' && organizationId) {
      matchStage.$or = [
        { visibility: 'public' },
        { visibility: 'organization', organizationId: new mongoose.Types.ObjectId(organizationId) }
      ];
    }

    // Date range
    if (startDate) {
      matchStage.startDateTime = { $gte: new Date(startDate) };
    }
    if (endDate) {
      matchStage.endDateTime = { ...(matchStage.endDateTime || {}), $lte: new Date(endDate) };
    }

    // Price range
    if (minPrice !== undefined) {
      matchStage.price = { $gte: Number(minPrice) };
    }
    if (maxPrice !== undefined) {
      matchStage.price = { ...(matchStage.price || {}), $lte: Number(maxPrice) };
    }

    // Free events filter
    if (isFree !== undefined) {
      matchStage.isFree = isFree === 'true' || isFree === true;
    }

    // Location filter (simple string match)
    if (location) {
      matchStage.location = { $regex: location, $options: 'i' };
    }

    // Status filter
    if (status) {
      matchStage.status = status;
    }

    // Tags filter
    if (tags && tags.length > 0) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      matchStage.tags = { $in: tagArray };
    }

    // Build sort options
    let sortStage = {};
    switch (sortBy) {
      case 'date':
        sortStage = { startDateTime: 1 };
        break;
      case 'date_desc':
        sortStage = { startDateTime: -1 };
        break;
      case 'price':
        sortStage = { price: 1 };
        break;
      case 'price_desc':
        sortStage = { price: -1 };
        break;
      case 'popularity':
        sortStage = { 'analytics.views': -1 };
        break;
      case 'newest':
        sortStage = { createdAt: -1 };
        break;
      case 'relevance':
      default:
        if (query) {
          sortStage = { score: { $meta: 'textScore' } };
        } else {
          sortStage = { startDateTime: 1 };
        }
    }

    const skip = (page - 1) * limit;

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage }
    ];

    // Add text score if searching
    if (query && query.trim()) {
      pipeline.push({
        $addFields: { score: { $meta: 'textScore' } }
      });
    }

    pipeline.push(
      { $sort: sortStage },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'organizer',
          foreignField: '_id',
          as: 'organizerInfo'
        }
      },
      {
        $addFields: {
          category: { $arrayElemAt: ['$categoryInfo', 0] },
          organizer: {
            $let: {
              vars: { org: { $arrayElemAt: ['$organizerInfo', 0] } },
              in: {
                _id: '$$org._id',
                firstName: '$$org.firstName',
                lastName: '$$org.lastName',
                avatar: '$$org.avatar'
              }
            }
          }
        }
      },
      {
        $project: {
          categoryInfo: 0,
          organizerInfo: 0,
          isDeleted: 0,
          deletedAt: 0,
          deletedBy: 0
        }
      }
    );

    // Get total count
    const countPipeline = [
      { $match: matchStage },
      { $count: 'total' }
    ];

    const [results, countResult] = await Promise.all([
      Event.aggregate(pipeline),
      Event.aggregate(countPipeline)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      events: results,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      },
      filters: {
        query,
        category,
        organizationId,
        startDate,
        endDate,
        minPrice,
        maxPrice,
        location,
        status,
        tags,
        isFree
      }
    };
  }

  /**
   * Get search suggestions/autocomplete
   */
  static async getSuggestions(query, limit = 10) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }

    const regex = new RegExp(`^${query}`, 'i');

    // Get event title suggestions
    const titleSuggestions = await Event.aggregate([
      {
        $match: {
          title: regex,
          isDeleted: { $ne: true },
          visibility: 'public'
        }
      },
      { $limit: limit },
      {
        $project: {
          text: '$title',
          type: { $literal: 'event' },
          id: '$_id'
        }
      }
    ]);

    // Get tag suggestions
    const tagSuggestions = await Event.aggregate([
      { $unwind: '$tags' },
      { $match: { tags: regex } },
      { $group: { _id: '$tags' } },
      { $limit: limit },
      {
        $project: {
          text: '$_id',
          type: { $literal: 'tag' }
        }
      }
    ]);

    // Get category suggestions
    const categorySuggestions = await Category.aggregate([
      {
        $match: {
          name: regex,
          isDeleted: { $ne: true },
          isActive: true
        }
      },
      { $limit: 5 },
      {
        $project: {
          text: '$name',
          type: { $literal: 'category' },
          id: '$_id'
        }
      }
    ]);

    // Combine and deduplicate
    const allSuggestions = [
      ...titleSuggestions,
      ...categorySuggestions,
      ...tagSuggestions
    ].slice(0, limit);

    return {
      suggestions: allSuggestions,
      query
    };
  }

  /**
   * Get popular/trending events
   */
  static async getTrendingEvents(options = {}) {
    const { organizationId, limit = 10 } = options;

    const matchStage = {
      isDeleted: { $ne: true },
      visibility: 'public',
      status: { $in: ['upcoming', 'ongoing'] },
      startDateTime: { $gte: new Date() }
    };

    if (organizationId) {
      matchStage.$or = [
        { visibility: 'public' },
        { organizationId: new mongoose.Types.ObjectId(organizationId) }
      ];
    }

    const events = await Event.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          trendScore: {
            $add: [
              { $multiply: ['$analytics.views', 1] },
              { $multiply: ['$analytics.registrations', 5] },
              { $multiply: [{ $size: { $ifNull: ['$attendees', []] } }, 3] }
            ]
          }
        }
      },
      { $sort: { trendScore: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    ]);

    return { events };
  }

  /**
   * Get similar events based on an event
   */
  static async getSimilarEvents(eventId, limit = 5) {
    const event = await Event.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const matchStage = {
      _id: { $ne: new mongoose.Types.ObjectId(eventId) },
      isDeleted: { $ne: true },
      visibility: 'public',
      status: { $in: ['upcoming', 'ongoing'] }
    };

    // Find by category or tags
    if (event.category) {
      matchStage.category = event.category;
    } else if (event.tags && event.tags.length > 0) {
      matchStage.tags = { $in: event.tags };
    }

    const similarEvents = await Event.find(matchStage)
      .sort({ startDateTime: 1 })
      .limit(limit)
      .populate('category', 'name')
      .populate('organizer', 'firstName lastName avatar');

    return { events: similarEvents };
  }
}

module.exports = SearchService;
