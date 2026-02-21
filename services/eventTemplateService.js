const EventTemplate = require('../models/eventTemplate');
const Category = require('../models/category');

class EventTemplateService {
  /**
   * Get all templates with filtering and pagination
   */
  static async getTemplates(options = {}) {
    try {
      const {
        category,
        isPublic = true,
        search,
        page = 1,
        limit = 10,
        sortBy = 'usageCount',
        sortOrder = 'desc'
      } = options;

      // Build query
      const query = {};
      
      if (isPublic !== undefined) {
        query.isPublic = isPublic;
      }
      
      if (category) {
        query.category = category;
      }
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'templateData.title': { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Execute query
      const templates = await EventTemplate.find(query)
        .populate('category', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await EventTemplate.countDocuments(query);

      return {
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(templateId) {
    try {
      const template = await EventTemplate.findById(templateId)
        .populate('category', 'name')
        .lean();

      if (!template) {
        throw new Error('Template not found');
      }

      return template;
    } catch (error) {
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  /**
   * Get popular templates
   */
  static async getPopularTemplates(limit = 10) {
    try {
      const templates = await EventTemplate.find({ isPublic: true })
        .populate('category', 'name')
        .sort({ usageCount: -1, rating: -1 })
        .limit(parseInt(limit))
        .lean();

      return { templates };
    } catch (error) {
      throw new Error(`Failed to get popular templates: ${error.message}`);
    }
  }

  /**
   * Get templates by category
   */
  static async getTemplatesByCategory(categoryId, limit = 10) {
    try {
      const templates = await EventTemplate.find({ 
        category: categoryId, 
        isPublic: true 
      })
        .populate('category', 'name')
        .sort({ usageCount: -1 })
        .limit(parseInt(limit))
        .lean();

      return { templates };
    } catch (error) {
      throw new Error(`Failed to get templates by category: ${error.message}`);
    }
  }

  /**
   * Create new template
   */
  static async createTemplate(templateData, userId) {
    try {
      const template = new EventTemplate({
        ...templateData,
        createdBy: userId,
        usageCount: 0,
        rating: 0
      });

      await template.save();
      return await this.getTemplateById(template._id);
    } catch (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  /**
   * Update template
   */
  static async updateTemplate(templateId, updateData, userId) {
    try {
      const template = await EventTemplate.findOne({
        _id: templateId,
        createdBy: userId
      });

      if (!template) {
        throw new Error('Template not found or access denied');
      }

      Object.assign(template, updateData);
      await template.save();

      return await this.getTemplateById(templateId);
    } catch (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  /**
   * Delete template
   */
  static async deleteTemplate(templateId, userId) {
    try {
      const template = await EventTemplate.findOne({
        _id: templateId,
        createdBy: userId
      });

      if (!template) {
        throw new Error('Template not found or access denied');
      }

      await EventTemplate.findByIdAndDelete(templateId);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(templateId) {
    try {
      await EventTemplate.findByIdAndUpdate(
        templateId,
        { $inc: { usageCount: 1 } }
      );
    } catch (error) {
      console.error('Failed to increment usage count:', error.message);
    }
  }

  /**
   * Update template rating
   */
  static async updateRating(templateId, rating) {
    try {
      const template = await EventTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Simple average rating calculation
      const newRating = (template.rating + rating) / 2;
      template.rating = Math.round(newRating * 10) / 10; // Round to 1 decimal place
      
      await template.save();
      return template.rating;
    } catch (error) {
      throw new Error(`Failed to update rating: ${error.message}`);
    }
  }

  /**
   * Get user's templates
   */
  static async getUserTemplates(userId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const templates = await EventTemplate.find({ createdBy: userId })
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await EventTemplate.countDocuments({ createdBy: userId });

      return {
        templates,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get user templates: ${error.message}`);
    }
  }
}

module.exports = EventTemplateService;