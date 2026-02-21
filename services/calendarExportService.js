const ical = require('ical-generator').default || require('ical-generator');

class CalendarExportService {
  /**
   * Generate all calendar export formats for an event
   */
  static generateAllCalendarExports(event, options = {}) {
    const { timezone = 'UTC' } = options;
    
    return {
      ical: {
        url: `/api/calendar-export/${event._id}/ical?timezone=${timezone}`,
        name: 'iCal (.ics)',
        description: 'Download iCal file for Apple Calendar, Google Calendar, and other calendar apps'
      },
      google: {
        url: `/api/calendar-export/${event._id}/google`,
        name: 'Google Calendar',
        description: 'Add to Google Calendar'
      },
      outlook: {
        url: `/api/calendar-export/${event._id}/outlook`,
        name: 'Outlook Calendar',
        description: 'Add to Outlook Calendar'
      },
      yahoo: {
        url: `/api/calendar-export/${event._id}/yahoo`,
        name: 'Yahoo Calendar',
        description: 'Add to Yahoo Calendar'
      }
    };
  }

  /**
   * Generate iCal content for a single event
   */
  static generateICal(event, options = {}) {
    const { timezone = 'UTC' } = options;
    
    const calendar = ical({
      prodId: {
        company: 'Eazy Event',
        product: 'Event Calendar',
        language: 'EN'
      },
      name: event.title || 'Event',
      timezone: timezone
    });

    const organizer = event.organizer || {};
    const organizerName = organizer.username || 
                         `${organizer.firstName || ''} ${organizer.lastName || ''}`.trim() || 
                         'Event Organizer';
    const organizerEmail = organizer.email || 'noreply@eazyevent.com';

    calendar.createEvent({
      start: event.startDateTime,
      end: event.endDateTime,
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
      url: event.url || '',
      organizer: {
        name: organizerName,
        email: organizerEmail
      },
      status: event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
      busyStatus: 'BUSY',
      created: event.createdAt || new Date(),
      lastModified: event.updatedAt || new Date()
    });

    return calendar.toString();
  }

  /**
   * Generate Google Calendar URL
   */
  static generateGoogleCalendarUrl(event) {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title || 'Event',
      dates: `${this.formatDateForCalendar(event.startDateTime)}/${this.formatDateForCalendar(event.endDateTime)}`,
      details: event.description || '',
      location: event.location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /**
   * Generate Outlook Calendar URL
   */
  static generateOutlookCalendarUrl(event) {
    const params = new URLSearchParams({
      subject: event.title || 'Event',
      startdt: event.startDateTime.toISOString(),
      enddt: event.endDateTime.toISOString(),
      body: event.description || '',
      location: event.location || ''
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  }

  /**
   * Generate Yahoo Calendar URL
   */
  static generateYahooCalendarUrl(event) {
    const params = new URLSearchParams({
      v: '60',
      view: 'd',
      type: '20',
      title: event.title || 'Event',
      st: this.formatDateForCalendar(event.startDateTime),
      dur: this.calculateDuration(event.startDateTime, event.endDateTime),
      desc: event.description || '',
      in_loc: event.location || ''
    });

    return `https://calendar.yahoo.com/?${params.toString()}`;
  }

  /**
   * Generate bulk iCal for multiple events
   */
  static generateBulkICal(events, options = {}) {
    const { timezone = 'UTC', calendarName = 'Eazy Event Calendar' } = options;
    
    const calendar = ical({
      prodId: {
        company: 'Eazy Event',
        product: 'Event Calendar',
        language: 'EN'
      },
      name: calendarName,
      timezone: timezone
    });

    events.forEach(event => {
      const organizer = event.organizer || {};
      const organizerName = organizer.username || 
                           `${organizer.firstName || ''} ${organizer.lastName || ''}`.trim() || 
                           'Event Organizer';
      const organizerEmail = organizer.email || 'noreply@eazyevent.com';

      calendar.createEvent({
        start: event.startDateTime,
        end: event.endDateTime,
        summary: event.title,
        description: event.description || '',
        location: event.location || '',
        url: event.url || '',
        organizer: {
          name: organizerName,
          email: organizerEmail
        },
        status: event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED',
        busyStatus: 'BUSY',
        created: event.createdAt || new Date(),
        lastModified: event.updatedAt || new Date()
      });
    });

    return calendar.toString();
  }

  /**
   * Format date for calendar URLs (YYYYMMDDTHHmmssZ format)
   */
  static formatDateForCalendar(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  /**
   * Calculate duration in minutes between two dates
   */
  static calculateDuration(startDate, endDate) {
    if (!startDate || !endDate) return '60';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end - start;
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    return String(diffMinutes);
  }
}

module.exports = CalendarExportService;

