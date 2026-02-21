const { Message, ChatRoom } = require('../models/chat');
const Event = require('../models/event');
const { User } = require('../models/user');

class ChatService {
  /**
   * Create a new chat room for an event
   * @param {String} eventId - Event ID
   * @param {String} createdBy - User ID who created the room
   * @param {Object} roomData - Room configuration
   * @returns {Promise<Object>} Created chat room
   */
  static async createChatRoom(eventId, createdBy, roomData = {}) {
    try {
      const event = await Event.findById(eventId);
      if (!event) {
        throw new Error('Event not found');
      }

      const chatRoom = new ChatRoom({
        event: eventId,
        name: roomData.name || `${event.title} - General Chat`,
        description: roomData.description || `Chat room for ${event.title}`,
        type: roomData.type || 'general',
        isPrivate: roomData.isPrivate || false,
        createdBy,
        settings: {
          allowFileUploads: roomData.allowFileUploads !== false,
          maxFileSize: roomData.maxFileSize || 10485760,
          allowedFileTypes: roomData.allowedFileTypes || ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
          messageRetentionDays: roomData.messageRetentionDays || 30,
          requireApproval: roomData.requireApproval || false
        }
      });

      // Add creator as admin
      await chatRoom.addParticipant(createdBy, 'admin');

      // Add event organizer as admin if different from creator
      if (event.organizer.toString() !== createdBy.toString()) {
        await chatRoom.addParticipant(event.organizer, 'admin');
      }

      await chatRoom.save();
      return await this.getChatRoomById(chatRoom._id);
    } catch (error) {
      throw new Error(`Failed to create chat room: ${error.message}`);
    }
  }

  /**
   * Get chat room by ID with populated data
   * @param {String} roomId - Chat room ID
   * @returns {Promise<Object>} Chat room data
   */
  static async getChatRoomById(roomId) {
    try {
      const chatRoom = await ChatRoom.findById(roomId)
        .populate('event', 'title startDateTime endDateTime')
        .populate('participants.user', 'username firstName lastName email avatar')
        .populate('lastMessage')
        .populate('createdBy', 'username firstName lastName');

      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      return chatRoom;
    } catch (error) {
      throw new Error(`Failed to get chat room: ${error.message}`);
    }
  }

  /**
   * Get all chat rooms for an event
   * @param {String} eventId - Event ID
   * @param {String} userId - User ID
   * @returns {Promise<Array>} List of chat rooms
   */
  static async getEventChatRooms(eventId, userId) {
    try {
      const chatRooms = await ChatRoom.find({
        event: eventId,
        isActive: true,
        'participants.user': userId
      })
      .populate('event', 'title startDateTime endDateTime')
      .populate('participants.user', 'username firstName lastName email avatar')
      .populate('lastMessage')
      .populate('createdBy', 'username firstName lastName')
      .sort({ lastActivity: -1 });

      return chatRooms;
    } catch (error) {
      throw new Error(`Failed to get event chat rooms: ${error.message}`);
    }
  }

  /**
   * Join a chat room
   * @param {String} roomId - Chat room ID
   * @param {String} userId - User ID
   * @param {String} role - User role in the room
   * @returns {Promise<Object>} Updated chat room
   */
  static async joinChatRoom(roomId, userId, role = 'member') {
    try {
      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      if (!chatRoom.isActive) {
        throw new Error('Chat room is not active');
      }

      if (chatRoom.isPrivate) {
        // Check if user has permission to join private room
        const event = await Event.findById(chatRoom.event);
        if (event.organizer.toString() !== userId.toString()) {
          throw new Error('Permission denied to join private room');
        }
      }

      await chatRoom.addParticipant(userId, role);
      
      // Create system message
      const user = await User.findById(userId);
      const systemMessage = new Message({
        chatRoom: roomId,
        sender: userId,
        content: `${user.firstName} ${user.lastName} joined the chat`,
        messageType: 'system'
      });
      await systemMessage.save();

      chatRoom.lastMessage = systemMessage._id;
      chatRoom.lastActivity = new Date();
      await chatRoom.save();

      return await this.getChatRoomById(roomId);
    } catch (error) {
      throw new Error(`Failed to join chat room: ${error.message}`);
    }
  }

  /**
   * Leave a chat room
   * @param {String} roomId - Chat room ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Updated chat room
   */
  static async leaveChatRoom(roomId, userId) {
    try {
      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      await chatRoom.removeParticipant(userId);

      // Create system message
      const user = await User.findById(userId);
      const systemMessage = new Message({
        chatRoom: roomId,
        sender: userId,
        content: `${user.firstName} ${user.lastName} left the chat`,
        messageType: 'system'
      });
      await systemMessage.save();

      chatRoom.lastMessage = systemMessage._id;
      chatRoom.lastActivity = new Date();
      await chatRoom.save();

      return await this.getChatRoomById(roomId);
    } catch (error) {
      throw new Error(`Failed to leave chat room: ${error.message}`);
    }
  }

  /**
   * Send a message to a chat room
   * @param {String} roomId - Chat room ID
   * @param {String} senderId - Sender user ID
   * @param {Object} messageData - Message data
   * @returns {Promise<Object>} Created message
   */
  static async sendMessage(roomId, senderId, messageData) {
    try {
      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      if (!chatRoom.isActive) {
        throw new Error('Chat room is not active');
      }

      if (!chatRoom.canSendMessage(senderId)) {
        throw new Error('You cannot send messages to this chat room');
      }

      const message = new Message({
        chatRoom: roomId,
        sender: senderId,
        content: messageData.content,
        messageType: messageData.messageType || 'text',
        attachments: messageData.attachments || [],
        replyTo: messageData.replyTo || null,
        mentions: messageData.mentions || []
      });

      await message.save();

      // Update chat room last message and activity
      chatRoom.lastMessage = message._id;
      chatRoom.lastActivity = new Date();
      await chatRoom.save();

      return await this.getMessageById(message._id);
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Get message by ID with populated data
   * @param {String} messageId - Message ID
   * @returns {Promise<Object>} Message data
   */
  static async getMessageById(messageId) {
    try {
      const message = await Message.findById(messageId)
        .populate('sender', 'username firstName lastName email avatar')
        .populate('replyTo')
        .populate('mentions', 'username firstName lastName');

      if (!message) {
        throw new Error('Message not found');
      }

      return message;
    } catch (error) {
      throw new Error(`Failed to get message: ${error.message}`);
    }
  }

  /**
   * Get messages for a chat room
   * @param {String} roomId - Chat room ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of messages
   */
  static async getChatRoomMessages(roomId, options = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        before = null,
        after = null
      } = options;

      const query = {
        chatRoom: roomId,
        isDeleted: false
      };

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      } else if (after) {
        query.createdAt = { $gt: new Date(after) };
      }

      const messages = await Message.find(query)
        .populate('sender', 'username firstName lastName email avatar')
        .populate('replyTo')
        .populate('mentions', 'username firstName lastName')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      return messages.reverse();
    } catch (error) {
      throw new Error(`Failed to get chat room messages: ${error.message}`);
    }
  }

  /**
   * Edit a message
   * @param {String} messageId - Message ID
   * @param {String} userId - User ID
   * @param {String} newContent - New message content
   * @returns {Promise<Object>} Updated message
   */
  static async editMessage(messageId, userId, newContent) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      if (message.sender.toString() !== userId.toString()) {
        throw new Error('You can only edit your own messages');
      }

      if (message.isDeleted) {
        throw new Error('Cannot edit deleted message');
      }

      message.content = newContent;
      message.isEdited = true;
      message.editedAt = new Date();

      await message.save();
      return await this.getMessageById(messageId);
    } catch (error) {
      throw new Error(`Failed to edit message: ${error.message}`);
    }
  }

  /**
   * Delete a message
   * @param {String} messageId - Message ID
   * @param {String} userId - User ID
   * @param {Boolean} permanent - Whether to permanently delete
   * @returns {Promise<Object>} Updated message
   */
  static async deleteMessage(messageId, userId, permanent = false) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const chatRoom = await ChatRoom.findById(message.chatRoom);
      const participant = chatRoom.participants.find(p => p.user.toString() === userId.toString());

      // Check permissions
      if (message.sender.toString() !== userId.toString() && 
          (!participant || !['admin', 'moderator'].includes(participant.role))) {
        throw new Error('You can only delete your own messages');
      }

      if (permanent) {
        await Message.findByIdAndDelete(messageId);
        return { deleted: true };
      } else {
        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();
        return await this.getMessageById(messageId);
      }
    } catch (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  }

  /**
   * Add reaction to a message
   * @param {String} messageId - Message ID
   * @param {String} userId - User ID
   * @param {String} emoji - Reaction emoji
   * @returns {Promise<Object>} Updated message
   */
  static async addReaction(messageId, userId, emoji) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Remove existing reaction from this user
      message.reactions = message.reactions.filter(r => r.user.toString() !== userId.toString());
      
      // Add new reaction
      message.reactions.push({
        user: userId,
        emoji,
        createdAt: new Date()
      });

      await message.save();
      return await this.getMessageById(messageId);
    } catch (error) {
      throw new Error(`Failed to add reaction: ${error.message}`);
    }
  }

  /**
   * Remove reaction from a message
   * @param {String} messageId - Message ID
   * @param {String} userId - User ID
   * @param {String} emoji - Reaction emoji
   * @returns {Promise<Object>} Updated message
   */
  static async removeReaction(messageId, userId, emoji) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      message.reactions = message.reactions.filter(r => 
        !(r.user.toString() === userId.toString() && r.emoji === emoji)
      );

      await message.save();
      return await this.getMessageById(messageId);
    } catch (error) {
      throw new Error(`Failed to remove reaction: ${error.message}`);
    }
  }

  /**
   * Mark messages as read
   * @param {String} roomId - Chat room ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Updated participant
   */
  static async markAsRead(roomId, userId) {
    try {
      const chatRoom = await ChatRoom.findById(roomId);
      if (!chatRoom) {
        throw new Error('Chat room not found');
      }

      const participant = chatRoom.participants.find(p => p.user.toString() === userId.toString());
      if (participant) {
        participant.lastReadAt = new Date();
        await chatRoom.save();
      }

      return participant;
    } catch (error) {
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Get unread message count for a user
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Unread counts by room
   */
  static async getUnreadCounts(userId) {
    try {
      const chatRooms = await ChatRoom.find({
        'participants.user': userId,
        isActive: true
      }).populate('participants.user');

      const unreadCounts = {};

      for (const room of chatRooms) {
        const participant = room.participants.find(p => p.user.toString() === userId.toString());
        if (participant) {
          const unreadCount = await Message.countDocuments({
            chatRoom: room._id,
            createdAt: { $gt: participant.lastReadAt },
            isDeleted: false,
            sender: { $ne: userId }
          });
          unreadCounts[room._id.toString()] = unreadCount;
        }
      }

      return unreadCounts;
    } catch (error) {
      throw new Error(`Failed to get unread counts: ${error.message}`);
    }
  }
}

module.exports = ChatService;