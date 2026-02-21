const Event = require('../models/event');
const User = require('../models/user');
const { v4: uuidv4 } = require('uuid');

class EventCollaborationService {
  /**
   * Add co-organizer to event
   * @param {String} eventId - Event ID
   * @param {String} userId - User ID to add as co-organizer
   * @param {String} role - Co-organizer role
   * @param {Array} permissions - Permissions array
   * @param {String} addedBy - User ID who is adding the co-organizer
   * @returns {Promise<Object>} Add result
   */
  static async addCoOrganizer(eventId, userId, role = 'co-organizer', permissions = [], addedBy) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if user is already a co-organizer
      const existingCoOrganizer = event.coOrganizers.find(co => co.user.toString() === userId);
      if (existingCoOrganizer) {
        throw new Error('User is already a co-organizer');
      }
      
      // Check if user is the main organizer
      if (event.organizer.toString() === userId) {
        throw new Error('User is already the main organizer');
      }
      
      // Add co-organizer
      const coOrganizer = {
        user: userId,
        role,
        permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(role),
        addedAt: new Date(),
        addedBy
      };
      
      event.coOrganizers.push(coOrganizer);
      await event.save();
      
      return {
        success: true,
        coOrganizer: {
          user: {
            id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar
          },
          role: coOrganizer.role,
          permissions: coOrganizer.permissions,
          addedAt: coOrganizer.addedAt
        }
      };
    } catch (error) {
      throw new Error(`Failed to add co-organizer: ${error.message}`);
    }
  }
  
  /**
   * Remove co-organizer from event
   * @param {String} eventId - Event ID
   * @param {String} userId - User ID to remove
   * @param {String} removedBy - User ID who is removing the co-organizer
   * @returns {Promise<Object>} Remove result
   */
  static async removeCoOrganizer(eventId, userId, removedBy) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if user is a co-organizer
      const coOrganizerIndex = event.coOrganizers.findIndex(co => co.user.toString() === userId);
      if (coOrganizerIndex === -1) {
        throw new Error('User is not a co-organizer');
      }
      
      // Remove co-organizer
      const removedCoOrganizer = event.coOrganizers[coOrganizerIndex];
      event.coOrganizers.splice(coOrganizerIndex, 1);
      await event.save();
      
      return {
        success: true,
        removedCoOrganizer: {
          userId,
          role: removedCoOrganizer.role,
          removedAt: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to remove co-organizer: ${error.message}`);
    }
  }
  
  /**
   * Update co-organizer permissions
   * @param {String} eventId - Event ID
   * @param {String} userId - User ID
   * @param {Array} permissions - New permissions array
   * @param {String} updatedBy - User ID who is updating permissions
   * @returns {Promise<Object>} Update result
   */
  static async updateCoOrganizerPermissions(eventId, userId, permissions, updatedBy) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if user is a co-organizer
      const coOrganizer = event.coOrganizers.find(co => co.user.toString() === userId);
      if (!coOrganizer) {
        throw new Error('User is not a co-organizer');
      }
      
      // Update permissions
      coOrganizer.permissions = permissions;
      coOrganizer.updatedAt = new Date();
      coOrganizer.updatedBy = updatedBy;
      
      await event.save();
      
      return {
        success: true,
        coOrganizer: {
          userId,
          role: coOrganizer.role,
          permissions: coOrganizer.permissions,
          updatedAt: coOrganizer.updatedAt
        }
      };
    } catch (error) {
      throw new Error(`Failed to update co-organizer permissions: ${error.message}`);
    }
  }
  
  /**
   * Get event collaborators
   * @param {String} eventId - Event ID
   * @returns {Promise<Object>} Collaborators list
   */
  static async getEventCollaborators(eventId) {
    try {
      const event = await Event.findById(eventId)
        .populate('organizer', 'username firstName lastName email avatar')
        .populate('coOrganizers.user', 'username firstName lastName email avatar');
      
      if (!event) {
        throw new Error('Event not found');
      }
      
      const collaborators = {
        organizer: {
          user: event.organizer,
          role: 'organizer',
          permissions: ['all'], // Main organizer has all permissions
          addedAt: event.createdAt
        },
        coOrganizers: event.coOrganizers.map(co => ({
          user: co.user,
          role: co.role,
          permissions: co.permissions,
          addedAt: co.addedAt,
          addedBy: co.addedBy
        }))
      };
      
      return {
        success: true,
        collaborators
      };
    } catch (error) {
      throw new Error(`Failed to get event collaborators: ${error.message}`);
    }
  }
  
  /**
   * Check if user has permission for event action
   * @param {String} eventId - Event ID
   * @param {String} userId - User ID
   * @param {String} action - Action to check
   * @returns {Promise<Boolean>} Has permission
   */
  static async hasPermission(eventId, userId, action) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        return false;
      }
      
      // Check if user is the main organizer
      if (event.organizer.toString() === userId) {
        return true; // Main organizer has all permissions
      }
      
      // Check if user is a co-organizer with required permission
      const coOrganizer = event.coOrganizers.find(co => co.user.toString() === userId);
      if (!coOrganizer) {
        return false;
      }
      
      return coOrganizer.permissions.includes(action) || coOrganizer.permissions.includes('all');
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get default permissions for role
   * @param {String} role - Co-organizer role
   * @returns {Array} Default permissions
   */
  static getDefaultPermissions(role) {
    const permissionMap = {
      'co-organizer': ['edit', 'manage_attendees', 'send_emails', 'view_analytics'],
      'assistant': ['manage_attendees', 'send_emails'],
      'moderator': ['manage_attendees']
    };
    
    return permissionMap[role] || ['manage_attendees'];
  }
  
  /**
   * Get available roles
   * @returns {Array} Available roles
   */
  static getAvailableRoles() {
    return [
      {
        value: 'co-organizer',
        label: 'Co-Organizer',
        description: 'Full access to event management',
        permissions: ['edit', 'delete', 'manage_attendees', 'send_emails', 'view_analytics']
      },
      {
        value: 'assistant',
        label: 'Assistant',
        description: 'Help with attendee management and communications',
        permissions: ['manage_attendees', 'send_emails']
      },
      {
        value: 'moderator',
        label: 'Moderator',
        description: 'Help with attendee management only',
        permissions: ['manage_attendees']
      }
    ];
  }
  
  /**
   * Get available permissions
   * @returns {Array} Available permissions
   */
  static getAvailablePermissions() {
    return [
      {
        value: 'edit',
        label: 'Edit Event',
        description: 'Modify event details, dates, and settings'
      },
      {
        value: 'delete',
        label: 'Delete Event',
        description: 'Delete the event permanently'
      },
      {
        value: 'manage_attendees',
        label: 'Manage Attendees',
        description: 'View, add, remove, and manage event attendees'
      },
      {
        value: 'send_emails',
        label: 'Send Emails',
        description: 'Send emails to attendees and co-organizers'
      },
      {
        value: 'view_analytics',
        label: 'View Analytics',
        description: 'Access event analytics and reports'
      }
    ];
  }
  
  /**
   * Transfer event ownership
   * @param {String} eventId - Event ID
   * @param {String} newOwnerId - New owner user ID
   * @param {String} currentOwnerId - Current owner user ID
   * @returns {Promise<Object>} Transfer result
   */
  static async transferOwnership(eventId, newOwnerId, currentOwnerId) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }
      
      // Check if current user is the owner
      if (event.organizer.toString() !== currentOwnerId) {
        throw new Error('Only the current owner can transfer ownership');
      }
      
      // Check if new owner exists
      const newOwner = await User.findById(newOwnerId);
      if (!newOwner) {
        throw new Error('New owner not found');
      }
      
      // Check if new owner is already a co-organizer
      const coOrganizerIndex = event.coOrganizers.findIndex(co => co.user.toString() === newOwnerId);
      
      // Update organizer
      const oldOwnerId = event.organizer;
      event.organizer = newOwnerId;
      
      // If new owner was a co-organizer, remove them from co-organizers
      if (coOrganizerIndex !== -1) {
        event.coOrganizers.splice(coOrganizerIndex, 1);
      }
      
      // Add old owner as co-organizer with full permissions
      event.coOrganizers.push({
        user: oldOwnerId,
        role: 'co-organizer',
        permissions: ['edit', 'manage_attendees', 'send_emails', 'view_analytics'],
        addedAt: new Date(),
        addedBy: newOwnerId
      });
      
      await event.save();
      
      return {
        success: true,
        newOwner: {
          id: newOwner._id,
          username: newOwner.username,
          firstName: newOwner.firstName,
          lastName: newOwner.lastName
        },
        oldOwner: {
          id: oldOwnerId,
          role: 'co-organizer'
        }
      };
    } catch (error) {
      throw new Error(`Failed to transfer ownership: ${error.message}`);
    }
  }
}

module.exports = EventCollaborationService;