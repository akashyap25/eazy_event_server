const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET;

class QRService {
  generateTicketToken(ticketData) {
    const { eventId, orderId, attendeeId, ticketType } = ticketData;
    
    return jwt.sign(
      {
        eventId,
        orderId,
        attendeeId,
        ticketType,
        issuedAt: Date.now()
      },
      QR_SECRET,
      { expiresIn: '30d' }
    );
  }

  verifyTicketToken(token) {
    try {
      const decoded = jwt.verify(token, QR_SECRET);
      return { valid: true, data: decoded };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { valid: false, error: 'Ticket has expired' };
      }
      return { valid: false, error: 'Invalid ticket' };
    }
  }

  async generateQRCode(ticketData, options = {}) {
    const token = this.generateTicketToken(ticketData);
    
    const qrOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: options.width || 300,
      margin: 2,
      color: {
        dark: options.darkColor || '#000000',
        light: options.lightColor || '#FFFFFF'
      }
    };

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(token, qrOptions);
    
    // Generate QR code as buffer for email/PDF
    const qrBuffer = await QRCode.toBuffer(token, qrOptions);
    
    return {
      token,
      dataUrl: qrDataUrl,
      buffer: qrBuffer
    };
  }

  async generateQRCodeSVG(ticketData) {
    const token = this.generateTicketToken(ticketData);
    const svg = await QRCode.toString(token, { type: 'svg', margin: 2 });
    return { token, svg };
  }

  generateCheckInUrl(token, baseUrl) {
    return `${baseUrl}/check-in?ticket=${encodeURIComponent(token)}`;
  }

  async generateTicketPDF(ticketData, eventDetails) {
    const qr = await this.generateQRCode(ticketData);
    
    return {
      qrCode: qr.dataUrl,
      ticketNumber: `TKT-${ticketData.orderId.slice(-8).toUpperCase()}`,
      eventTitle: eventDetails.title,
      eventDate: eventDetails.startDateTime,
      venue: eventDetails.location,
      attendeeName: ticketData.attendeeName,
      ticketType: ticketData.ticketType || 'General Admission'
    };
  }
}

module.exports = new QRService();
