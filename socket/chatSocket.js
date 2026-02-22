const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ChatService = require('../services/chatService');
const { securityConfig } = require('../config/security');

class ChatSocket {
  constructor(io) {
    this.io = io;
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
          console.log('[ChatSocket] Connect: no token. handshake.auth=', JSON.stringify(socket.handshake.auth || {}));
          socket.userId = null;
          socket.user = null;
          socket.isAuthenticated = false;
          return next();
        }
        const secret = securityConfig.jwt.secret;
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
          console.log('[ChatSocket] Connect: token valid but user not found, userId=', decoded.userId);
          socket.userId = null;
          socket.user = null;
          socket.isAuthenticated = false;
          return next();
        }
        socket.userId = user._id.toString();
        socket.user = user;
        socket.isAuthenticated = true;
        console.log('[ChatSocket] Connect: authenticated', socket.userId);
        next();
      } catch (error) {
        console.log('[ChatSocket] Connect: auth failed', error.message);
        socket.userId = null;
        socket.user = null;
        socket.isAuthenticated = false;
        next();
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      if (socket.isAuthenticated && socket.user) {
        console.log(`User ${socket.user.username} connected to chat`);
      } else {
        console.log(`Anonymous user connected to chat`);
      }

      // Join event-specific rooms
      socket.on('join_event_rooms', async (eventId) => {
        try {
          const chatRooms = await ChatService.getEventChatRooms(eventId, socket.userId);
          
          for (const room of chatRooms) {
            socket.join(`room_${room._id}`);
            if (socket.user) {
              console.log(`User ${socket.user.username} joined room ${room.name}`);
            } else {
              console.log(`Anonymous user joined room ${room.name}`);
            }
          }
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Join specific chat room. Only event owner, collaborators, and registered attendees can join.
      socket.on('join_room', async (payload) => {
        try {
          const roomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
          const displayName = typeof payload === 'object' && payload !== null ? (payload.displayName || 'Guest').trim() : 'Guest';
          if (!roomId) {
            socket.emit('error', { message: 'roomId is required' });
            return;
          }

          if (!socket.isAuthenticated) {
            socket.emit('error', { message: 'Sign in to join the event chat.' });
            return;
          }

          const chatRoom = await ChatService.getChatRoomById(roomId);
          const eventId = chatRoom.event?._id || chatRoom.event;
          if (!eventId) {
            socket.emit('error', { message: 'Invalid chat room.' });
            return;
          }

          const canParticipate = await ChatService.canUserParticipateInEventChat(eventId, socket.userId);
          if (!canParticipate) {
            socket.emit('error', { message: 'Only the event owner, collaborators, and registered attendees can join the event chat.' });
            return;
          }

          const eventRole = await ChatService.getEventRoleForUser(eventId, socket.userId);
          socket.eventRole = eventRole;

          if (!chatRoom.isParticipant(socket.userId)) {
            await chatRoom.addParticipant(socket.userId, 'member');
          }

          socket.join(`room_${roomId}`);
          console.log(`User ${socket.user.username} (${eventRole}) joined room ${chatRoom.name}`);
          await ChatService.markAsRead(roomId, socket.userId);
          socket.emit('room_joined', { roomId, room: chatRoom, eventRole });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Leave chat room
      socket.on('leave_room', (roomId) => {
        socket.leave(`room_${roomId}`);
        if (socket.user) {
          console.log(`User ${socket.user.username} left room ${roomId}`);
        } else {
          console.log(`Anonymous user left room ${roomId}`);
        }
        socket.emit('room_left', { roomId });
      });

      // Send message. Only authenticated users who joined as owner/collaborator/attendee can send.
      socket.on('send_message', async (data) => {
        try {
          if (!socket.isAuthenticated || !socket.userId) {
            socket.emit('error', { message: 'Sign in to send messages.' });
            return;
          }
          if (!socket.eventRole) {
            socket.emit('error', { message: 'Only event owner, collaborators, and registered attendees can send messages. Join the room first.' });
            return;
          }

          const { roomId, content, messageType = 'text', replyTo, mentions = [] } = data;

          if (!content || content.trim().length === 0) {
            socket.emit('error', { message: 'Message content cannot be empty' });
            return;
          }

          const message = await ChatService.sendMessage(roomId, socket.userId, {
            content: content.trim(),
            messageType,
            replyTo,
            mentions,
            senderEventRole: socket.eventRole
          });

          this.io.to(`room_${roomId}`).emit('new_message', { roomId, message });

          const displayName = socket.user?.firstName || socket.user?.username || 'User';
          socket.to(`room_${roomId}`).emit('user_stopped_typing', { userId: socket.userId, username: displayName });

        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Edit message
      socket.on('edit_message', async (data) => {
        try {
          const { messageId, newContent } = data;

          const message = await ChatService.editMessage(messageId, socket.userId, newContent);

          // Broadcast edited message to all users in the room
          this.io.to(`room_${message.chatRoom}`).emit('message_edited', {
            messageId,
            message
          });

        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Delete message
      socket.on('delete_message', async (data) => {
        try {
          const { messageId, permanent = false } = data;

          const result = await ChatService.deleteMessage(messageId, socket.userId, permanent);

          if (result.deleted) {
            // Broadcast deletion to all users in the room
            this.io.emit('message_deleted', {
              messageId,
              permanent
            });
          } else {
            // Broadcast updated message to all users in the room
            this.io.to(`room_${result.chatRoom}`).emit('message_updated', {
              messageId,
              message: result
            });
          }

        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Add reaction
      socket.on('add_reaction', async (data) => {
        try {
          const { messageId, emoji } = data;

          const message = await ChatService.addReaction(messageId, socket.userId, emoji);

          // Broadcast reaction to all users in the room
          this.io.to(`room_${message.chatRoom}`).emit('reaction_added', {
            messageId,
            message
          });

        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Remove reaction
      socket.on('remove_reaction', async (data) => {
        try {
          const { messageId, emoji } = data;

          const message = await ChatService.removeReaction(messageId, socket.userId, emoji);

          // Broadcast reaction removal to all users in the room
          this.io.to(`room_${message.chatRoom}`).emit('reaction_removed', {
            messageId,
            message
          });

        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Typing indicators
      socket.on('typing_start', (data) => {
        const { roomId } = data;
        socket.to(`room_${roomId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.user ? socket.user.username : 'Anonymous'
        });
      });

      socket.on('typing_stop', (data) => {
        const { roomId } = data;
        socket.to(`room_${roomId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          username: socket.user ? socket.user.username : 'Anonymous'
        });
      });

      // Mark as read
      socket.on('mark_as_read', async (data) => {
        try {
          const { roomId } = data;
          await ChatService.markAsRead(roomId, socket.userId);
          
          // Broadcast read status to other users
          socket.to(`room_${roomId}`).emit('user_read', {
            userId: socket.userId,
            username: socket.user ? socket.user.username : 'Anonymous',
            roomId
          });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Get unread counts
      socket.on('get_unread_counts', async () => {
        try {
          const unreadCounts = await ChatService.getUnreadCounts(socket.userId);
          socket.emit('unread_counts', unreadCounts);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.user) {
          console.log(`User ${socket.user.username} disconnected from chat`);
        } else {
          console.log(`Anonymous user disconnected from chat`);
        }
      });
    });
  }

  // Broadcast system message to event participants
  async broadcastSystemMessage(eventId, content, messageType = 'system') {
    try {
      const chatRooms = await ChatService.getEventChatRooms(eventId, null);
      
      for (const room of chatRooms) {
        const systemMessage = await ChatService.sendMessage(room._id, null, {
          content,
          messageType
        });

        this.io.to(`room_${room._id}`).emit('new_message', {
          roomId: room._id,
          message: systemMessage
        });
      }
    } catch (error) {
      console.error('Error broadcasting system message:', error);
    }
  }

  // Notify users about new chat room
  async notifyNewChatRoom(eventId, chatRoom) {
    try {
      const event = await require('../models/event').Event.findById(eventId);
      if (event) {
        // Get all event participants
        const participants = await require('../models/order').Order.find({
          eventId,
          status: 'confirmed'
        }).populate('userId', 'username firstName lastName');

        for (const participant of participants) {
          const socket = this.io.sockets.sockets.get(participant.userId._id.toString());
          if (socket) {
            socket.emit('new_chat_room', { chatRoom });
          }
        }
      }
    } catch (error) {
      console.error('Error notifying new chat room:', error);
    }
  }
}

module.exports = ChatSocket;