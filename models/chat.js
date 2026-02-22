const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  senderGuestDisplayName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: null
  },
  senderEventRole: {
    type: String,
    enum: ['owner', 'collaborator', 'attendee'],
    default: null
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
  const uid = userId.toString();
  const existingParticipant = this.participants.find(p => (p.user && (p.user._id ? p.user._id : p.user).toString()) === uid);
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
  const uid = userId.toString();
  this.participants = this.participants.filter(p => participantUserId(p) !== uid);
  return this.save();
};

chatRoomSchema.methods.updateParticipantRole = function(userId, role) {
  const uid = userId.toString();
  const participant = this.participants.find(p => participantUserId(p) === uid);
  if (participant) {
    participant.role = role;
  }
  return this.save();
};

function participantUserId(p) {
  if (!p || !p.user) return null;
  return (p.user._id ? p.user._id : p.user).toString();
}

chatRoomSchema.methods.isParticipant = function(userId) {
  const uid = userId.toString();
  return this.participants.some(p => participantUserId(p) === uid && !p.isBanned);
};

chatRoomSchema.methods.canSendMessage = function(userId) {
  const uid = userId.toString();
  const participant = this.participants.find(p => participantUserId(p) === uid);
  return participant && !participant.isBanned && !participant.isMuted;
};

const Message = mongoose.model('Message', messageSchema);
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = { Message, ChatRoom };