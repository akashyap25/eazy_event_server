const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  attachments: [{
    url: String,
    filename: String,
    mimeType: String,
    size: Number
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

const chatRoomSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['general', 'announcements', 'qna', 'networking', 'custom'],
    default: 'general'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadAt: {
      type: Date,
      default: Date.now
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    isBanned: {
      type: Boolean,
      default: false
    }
  }],
  settings: {
    allowFileUploads: {
      type: Boolean,
      default: true
    },
    maxFileSize: {
      type: Number,
      default: 10485760 // 10MB
    },
    allowedFileTypes: [String],
    messageRetentionDays: {
      type: Number,
      default: 30
    },
    requireApproval: {
      type: Boolean,
      default: false
    }
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ isDeleted: 1, createdAt: -1 });

chatRoomSchema.index({ event: 1, isActive: 1 });
chatRoomSchema.index({ 'participants.user': 1, isActive: 1 });
chatRoomSchema.index({ lastActivity: -1 });
chatRoomSchema.index({ type: 1, isActive: 1 });

// Virtual for unread message count
chatRoomSchema.virtual('unreadCount', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'chatRoom',
  count: true,
  match: { isDeleted: false }
});

// Methods
messageSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  if (obj.isDeleted) {
    obj.content = 'This message was deleted';
    obj.attachments = [];
  }
  return obj;
};

chatRoomSchema.methods.addParticipant = function(userId, role = 'member') {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      role,
      joinedAt: new Date(),
      lastReadAt: new Date()
    });
  }
  return this.save();
};

chatRoomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => p.user.toString() !== userId.toString());
  return this.save();
};

chatRoomSchema.methods.updateParticipantRole = function(userId, role) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    participant.role = role;
  }
  return this.save();
};

chatRoomSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user.toString() === userId.toString() && !p.isBanned);
};

chatRoomSchema.methods.canSendMessage = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  return participant && !participant.isBanned && !participant.isMuted;
};

const Message = mongoose.model('Message', messageSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = { Message, ChatRoom };