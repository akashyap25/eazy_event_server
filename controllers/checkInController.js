const CheckIn = require('../models/checkIn');
const Order = require('../models/order');
const Event = require('../models/event');
const qrService = require('../services/qrService');
const { success, created, error, notFound, serverError } = require('../utils/responseHandler');

const generateTicketQR = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({
      _id: orderId,
      buyer: req.user.userId,
      status: 'completed'
    }).populate('event', 'title startDateTime location');
    
    if (!order) {
      return notFound(res, 'Order not found or not completed');
    }
    
    // Check if check-in record exists, create if not
    let checkIn = await CheckIn.findOne({ order: orderId });
    
    if (!checkIn) {
      const ticketData = {
        eventId: order.event._id.toString(),
        orderId: order._id.toString(),
        attendeeId: req.user.userId,
        ticketType: 'general'
      };
      
      const qr = await qrService.generateQRCode(ticketData);
      
      checkIn = await CheckIn.create({
        event: order.event._id,
        order: order._id,
        attendee: req.user.userId,
        ticketToken: qr.token,
        ticketType: 'general',
        organizationId: order.event.organizationId
      });
    } else {
      // Regenerate QR with existing token
      const qr = await qrService.generateQRCode({
        eventId: order.event._id.toString(),
        orderId: order._id.toString(),
        attendeeId: req.user.userId,
        ticketType: checkIn.ticketType
      });
      
      return success(res, {
        qrCode: qr.dataUrl,
        ticketNumber: `TKT-${order._id.toString().slice(-8).toUpperCase()}`,
        event: {
          title: order.event.title,
          date: order.event.startDateTime,
          location: order.event.location
        },
        status: checkIn.status
      });
    }
    
    const qr = await qrService.generateQRCode({
      eventId: order.event._id.toString(),
      orderId: order._id.toString(),
      attendeeId: req.user.userId,
      ticketType: checkIn.ticketType
    });
    
    return success(res, {
      qrCode: qr.dataUrl,
      ticketNumber: `TKT-${order._id.toString().slice(-8).toUpperCase()}`,
      event: {
        title: order.event.title,
        date: order.event.startDateTime,
        location: order.event.location
      },
      status: checkIn.status
    });
  } catch (err) {
    console.error('Generate ticket QR error:', err);
    return serverError(res, 'Failed to generate ticket QR');
  }
};

const scanCheckIn = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return error(res, 'Ticket token is required', 400);
    }
    
    // Verify token
    const verification = qrService.verifyTicketToken(token);
    
    if (!verification.valid) {
      return error(res, verification.error, 400);
    }
    
    const { eventId, orderId, attendeeId } = verification.data;
    
    // Find check-in record
    const checkIn = await CheckIn.findOne({ 
      ticketToken: token 
    }).populate('attendee', 'firstName lastName email avatar')
      .populate('event', 'title startDateTime');
    
    if (!checkIn) {
      return notFound(res, 'Ticket not found');
    }
    
    if (checkIn.status === 'checked_in') {
      return error(res, 'Attendee already checked in', 400, {
        checkInTime: checkIn.checkInTime,
        attendee: checkIn.attendee
      });
    }
    
    if (checkIn.status === 'cancelled') {
      return error(res, 'Ticket has been cancelled', 400);
    }
    
    // Perform check-in
    checkIn.status = 'checked_in';
    checkIn.checkInTime = new Date();
    checkIn.checkInBy = req.user.userId;
    checkIn.checkInMethod = 'qr_scan';
    checkIn.deviceInfo = req.headers['user-agent'];
    
    await checkIn.save();
    
    return success(res, {
      checkIn,
      message: `${checkIn.attendee.firstName} ${checkIn.attendee.lastName} checked in successfully`
    });
  } catch (err) {
    console.error('Scan check-in error:', err);
    return serverError(res, 'Failed to process check-in');
  }
};

const manualCheckIn = async (req, res) => {
  try {
    const { eventId, attendeeEmail, notes } = req.body;
    
    // Find attendee's order for this event
    const order = await Order.findOne({
      event: eventId,
      status: 'completed'
    }).populate('buyer', 'email');
    
    if (!order || order.buyer.email !== attendeeEmail) {
      return notFound(res, 'No valid registration found for this attendee');
    }
    
    let checkIn = await CheckIn.findOne({
      event: eventId,
      attendee: order.buyer._id
    });
    
    if (checkIn?.status === 'checked_in') {
      return error(res, 'Attendee already checked in', 400);
    }
    
    if (!checkIn) {
      const ticketData = {
        eventId,
        orderId: order._id.toString(),
        attendeeId: order.buyer._id.toString(),
        ticketType: 'general'
      };
      
      const qr = await qrService.generateQRCode(ticketData);
      
      checkIn = await CheckIn.create({
        event: eventId,
        order: order._id,
        attendee: order.buyer._id,
        ticketToken: qr.token,
        status: 'checked_in',
        checkInTime: new Date(),
        checkInBy: req.user.userId,
        checkInMethod: 'manual',
        notes
      });
    } else {
      checkIn.status = 'checked_in';
      checkIn.checkInTime = new Date();
      checkIn.checkInBy = req.user.userId;
      checkIn.checkInMethod = 'manual';
      checkIn.notes = notes;
      await checkIn.save();
    }
    
    await checkIn.populate('attendee', 'firstName lastName email');
    
    return success(res, { checkIn }, 'Manual check-in successful');
  } catch (err) {
    console.error('Manual check-in error:', err);
    return serverError(res, 'Failed to process manual check-in');
  }
};

const getEventCheckIns = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;
    
    const query = { event: eventId };
    if (status) query.status = status;
    
    const checkIns = await CheckIn.find(query)
      .sort({ checkInTime: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('attendee', 'firstName lastName email avatar')
      .populate('checkInBy', 'firstName lastName');
    
    const total = await CheckIn.countDocuments(query);
    const stats = await CheckIn.getEventStats(eventId);
    
    return success(res, {
      checkIns,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get event check-ins error:', err);
    return serverError(res, 'Failed to fetch check-ins');
  }
};

const getCheckInStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const stats = await CheckIn.getEventStats(eventId);
    const timeline = await CheckIn.getCheckInTimeline(eventId);
    
    return success(res, { stats, timeline });
  } catch (err) {
    console.error('Get check-in stats error:', err);
    return serverError(res, 'Failed to fetch check-in stats');
  }
};

const undoCheckIn = async (req, res) => {
  try {
    const { checkInId } = req.params;
    
    const checkIn = await CheckIn.findByIdAndUpdate(
      checkInId,
      {
        status: 'pending',
        checkInTime: null,
        checkInBy: null,
        notes: `Undone by ${req.user.userId} at ${new Date().toISOString()}`
      },
      { new: true }
    ).populate('attendee', 'firstName lastName email');
    
    if (!checkIn) {
      return notFound(res, 'Check-in record not found');
    }
    
    return success(res, { checkIn }, 'Check-in undone successfully');
  } catch (err) {
    console.error('Undo check-in error:', err);
    return serverError(res, 'Failed to undo check-in');
  }
};

const getMyTickets = async (req, res) => {
  try {
    const checkIns = await CheckIn.find({
      attendee: req.user.userId
    })
      .sort({ createdAt: -1 })
      .populate('event', 'title startDateTime endDateTime location imageUrl')
      .populate('order', 'totalAmount');
    
    const tickets = await Promise.all(checkIns.map(async (checkIn) => {
      const qr = await qrService.generateQRCode({
        eventId: checkIn.event._id.toString(),
        orderId: checkIn.order._id.toString(),
        attendeeId: req.user.userId,
        ticketType: checkIn.ticketType
      });
      
      return {
        id: checkIn._id,
        ticketNumber: `TKT-${checkIn.order._id.toString().slice(-8).toUpperCase()}`,
        qrCode: qr.dataUrl,
        event: checkIn.event,
        status: checkIn.status,
        checkInTime: checkIn.checkInTime,
        ticketType: checkIn.ticketType
      };
    }));
    
    return success(res, { tickets });
  } catch (err) {
    console.error('Get my tickets error:', err);
    return serverError(res, 'Failed to fetch tickets');
  }
};

module.exports = {
  generateTicketQR,
  scanCheckIn,
  manualCheckIn,
  getEventCheckIns,
  getCheckInStats,
  undoCheckIn,
  getMyTickets
};
