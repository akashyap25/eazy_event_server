const SupportTicket = require('../models/supportTicket');
const FAQ = require('../models/faq');
const { success, created, error, notFound, paginated, serverError } = require('../utils/responseHandler');

// Ticket Controllers
const createTicket = async (req, res) => {
  try {
    const { subject, description, category, priority, relatedEvent, relatedOrder } = req.body;
    
    const ticket = await SupportTicket.create({
      user: req.user.userId,
      organization: req.organization?._id,
      subject,
      description,
      category,
      priority,
      relatedEvent,
      relatedOrder,
      messages: [{
        sender: req.user.userId,
        content: description,
        isStaffReply: false
      }]
    });
    
    await ticket.populate('user', 'firstName lastName email');
    
    return created(res, { ticket }, 'Support ticket created successfully');
  } catch (err) {
    console.error('Create ticket error:', err);
    return serverError(res, 'Failed to create support ticket');
  }
};

const getTickets = async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user.userId, isDeleted: false };
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    
    const tickets = await SupportTicket.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('assignedTo', 'firstName lastName')
      .populate('relatedEvent', 'title');
    
    const total = await SupportTicket.countDocuments(query);
    
    return paginated(res, tickets, page, limit, total);
  } catch (err) {
    console.error('Get tickets error:', err);
    return serverError(res, 'Failed to fetch tickets');
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({
      _id: req.params.ticketId,
      user: req.user.userId,
      isDeleted: false
    })
      .populate('user', 'firstName lastName email avatar')
      .populate('messages.sender', 'firstName lastName avatar')
      .populate('assignedTo', 'firstName lastName')
      .populate('relatedEvent', 'title startDateTime')
      .populate('relatedOrder', 'totalAmount status');
    
    if (!ticket) {
      return notFound(res, 'Support ticket not found');
    }
    
    return success(res, { ticket });
  } catch (err) {
    console.error('Get ticket error:', err);
    return serverError(res, 'Failed to fetch ticket');
  }
};

const addMessage = async (req, res) => {
  try {
    const { content, attachments } = req.body;
    
    const ticket = await SupportTicket.findOne({
      _id: req.params.ticketId,
      user: req.user.userId,
      isDeleted: false
    });
    
    if (!ticket) {
      return notFound(res, 'Support ticket not found');
    }
    
    await ticket.addMessage(req.user.userId, content, false, attachments);
    
    // If ticket was resolved/closed and user replies, reopen it
    if (['resolved', 'closed'].includes(ticket.status)) {
      ticket.status = 'open';
      await ticket.save();
    }
    
    await ticket.populate('messages.sender', 'firstName lastName avatar');
    
    return success(res, { ticket }, 'Message added successfully');
  } catch (err) {
    console.error('Add message error:', err);
    return serverError(res, 'Failed to add message');
  }
};

const closeTicket = async (req, res) => {
  try {
    const ticket = await SupportTicket.findOneAndUpdate(
      {
        _id: req.params.ticketId,
        user: req.user.userId,
        isDeleted: false
      },
      { status: 'closed' },
      { new: true }
    );
    
    if (!ticket) {
      return notFound(res, 'Support ticket not found');
    }
    
    return success(res, { ticket }, 'Ticket closed successfully');
  } catch (err) {
    console.error('Close ticket error:', err);
    return serverError(res, 'Failed to close ticket');
  }
};

const rateTicket = async (req, res) => {
  try {
    const { score, feedback } = req.body;
    
    if (score < 1 || score > 5) {
      return error(res, 'Rating must be between 1 and 5', 400);
    }
    
    const ticket = await SupportTicket.findOneAndUpdate(
      {
        _id: req.params.ticketId,
        user: req.user.userId,
        status: { $in: ['resolved', 'closed'] },
        isDeleted: false
      },
      {
        rating: { score, feedback, ratedAt: new Date() }
      },
      { new: true }
    );
    
    if (!ticket) {
      return notFound(res, 'Ticket not found or not resolved yet');
    }
    
    return success(res, { ticket }, 'Thank you for your feedback');
  } catch (err) {
    console.error('Rate ticket error:', err);
    return serverError(res, 'Failed to rate ticket');
  }
};

// FAQ Controllers
const getFAQs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const organizationId = req.organization?._id;
    
    let faqs;
    
    if (search) {
      faqs = await FAQ.search(search, organizationId);
    } else if (category) {
      faqs = await FAQ.getByCategory(category, organizationId);
    } else {
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
      
      faqs = await FAQ.find(query).sort({ order: 1, category: 1 });
    }
    
    // Group by category
    const groupedFAQs = faqs.reduce((acc, faq) => {
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    }, {});
    
    return success(res, { faqs: groupedFAQs, total: faqs.length });
  } catch (err) {
    console.error('Get FAQs error:', err);
    return serverError(res, 'Failed to fetch FAQs');
  }
};

const getFAQById = async (req, res) => {
  try {
    const faq = await FAQ.findOne({
      _id: req.params.faqId,
      isPublished: true,
      isDeleted: false
    }).populate('relatedFaqs', 'question');
    
    if (!faq) {
      return notFound(res, 'FAQ not found');
    }
    
    // Increment view count
    await faq.incrementView();
    
    return success(res, { faq });
  } catch (err) {
    console.error('Get FAQ error:', err);
    return serverError(res, 'Failed to fetch FAQ');
  }
};

const voteFAQ = async (req, res) => {
  try {
    const { helpful } = req.body;
    
    if (typeof helpful !== 'boolean') {
      return error(res, 'helpful field must be a boolean', 400);
    }
    
    const faq = await FAQ.findOne({
      _id: req.params.faqId,
      isPublished: true,
      isDeleted: false
    });
    
    if (!faq) {
      return notFound(res, 'FAQ not found');
    }
    
    await faq.recordVote(req.user.userId, helpful);
    
    return success(res, { 
      helpfulCount: faq.helpfulCount,
      notHelpfulCount: faq.notHelpfulCount 
    }, 'Vote recorded');
  } catch (err) {
    console.error('Vote FAQ error:', err);
    return serverError(res, 'Failed to record vote');
  }
};

const getPopularFAQs = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const organizationId = req.organization?._id;
    
    const faqs = await FAQ.getPopular(parseInt(limit), organizationId);
    
    return success(res, { faqs });
  } catch (err) {
    console.error('Get popular FAQs error:', err);
    return serverError(res, 'Failed to fetch popular FAQs');
  }
};

// Admin Controllers
const getAdminTickets = async (req, res) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 20 } = req.query;
    
    const query = { isDeleted: false };
    
    if (req.organization?._id) {
      query.organization = req.organization._id;
    }
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    
    const tickets = await SupportTicket.find(query)
      .sort({ priority: -1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('user', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName');
    
    const total = await SupportTicket.countDocuments(query);
    const stats = await SupportTicket.getStats(req.organization?._id);
    
    return paginated(res, { tickets, stats }, page, limit, total);
  } catch (err) {
    console.error('Get admin tickets error:', err);
    return serverError(res, 'Failed to fetch tickets');
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { status, resolution } = req.body;
    
    const updateData = { status };
    
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = req.user.userId;
      if (resolution) updateData.resolution = resolution;
    }
    
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      updateData,
      { new: true }
    ).populate('user', 'firstName lastName email');
    
    if (!ticket) {
      return notFound(res, 'Ticket not found');
    }
    
    return success(res, { ticket }, 'Ticket status updated');
  } catch (err) {
    console.error('Update ticket status error:', err);
    return serverError(res, 'Failed to update ticket status');
  }
};

const assignTicket = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    
    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.ticketId,
      { 
        assignedTo,
        status: 'in_progress'
      },
      { new: true }
    ).populate('assignedTo', 'firstName lastName email');
    
    if (!ticket) {
      return notFound(res, 'Ticket not found');
    }
    
    return success(res, { ticket }, 'Ticket assigned successfully');
  } catch (err) {
    console.error('Assign ticket error:', err);
    return serverError(res, 'Failed to assign ticket');
  }
};

const addStaffReply = async (req, res) => {
  try {
    const { content, attachments } = req.body;
    
    const ticket = await SupportTicket.findById(req.params.ticketId);
    
    if (!ticket) {
      return notFound(res, 'Ticket not found');
    }
    
    await ticket.addMessage(req.user.userId, content, true, attachments);
    
    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
      await ticket.save();
    }
    
    await ticket.populate('messages.sender', 'firstName lastName avatar');
    
    return success(res, { ticket }, 'Reply added successfully');
  } catch (err) {
    console.error('Add staff reply error:', err);
    return serverError(res, 'Failed to add reply');
  }
};

// FAQ Admin Controllers
const createFAQ = async (req, res) => {
  try {
    const { question, answer, category, tags, order, isGlobal } = req.body;
    
    const faq = await FAQ.create({
      question,
      answer,
      category,
      tags,
      order,
      isGlobal: isGlobal !== false,
      organizationId: req.organization?._id,
      createdBy: req.user.userId
    });
    
    return created(res, { faq }, 'FAQ created successfully');
  } catch (err) {
    console.error('Create FAQ error:', err);
    return serverError(res, 'Failed to create FAQ');
  }
};

const updateFAQ = async (req, res) => {
  try {
    const updates = req.body;
    updates.lastUpdatedBy = req.user.userId;
    
    const faq = await FAQ.findByIdAndUpdate(
      req.params.faqId,
      updates,
      { new: true }
    );
    
    if (!faq) {
      return notFound(res, 'FAQ not found');
    }
    
    return success(res, { faq }, 'FAQ updated successfully');
  } catch (err) {
    console.error('Update FAQ error:', err);
    return serverError(res, 'Failed to update FAQ');
  }
};

const deleteFAQ = async (req, res) => {
  try {
    const faq = await FAQ.findByIdAndUpdate(
      req.params.faqId,
      { isDeleted: true },
      { new: true }
    );
    
    if (!faq) {
      return notFound(res, 'FAQ not found');
    }
    
    return success(res, null, 'FAQ deleted successfully');
  } catch (err) {
    console.error('Delete FAQ error:', err);
    return serverError(res, 'Failed to delete FAQ');
  }
};

module.exports = {
  // Ticket
  createTicket,
  getTickets,
  getTicketById,
  addMessage,
  closeTicket,
  rateTicket,
  // FAQ
  getFAQs,
  getFAQById,
  voteFAQ,
  getPopularFAQs,
  // Admin
  getAdminTickets,
  updateTicketStatus,
  assignTicket,
  addStaffReply,
  createFAQ,
  updateFAQ,
  deleteFAQ
};
