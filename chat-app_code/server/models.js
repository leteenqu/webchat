// server/models.js
const mongoose = require('mongoose');

// 用户模型
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  status: { type: String, default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  friends: [{ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],
  friendRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  }],
  createdAt: { type: Date, default: Date.now }
});

// 消息模型
const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  conversationId: { type: String, required: true }, // senderId-receiverId 排序后的组合
  type: { type: String, enum: ['text', 'image', 'file', 'voice'], default: 'text' },
  content: { type: String, required: true },
  fileName: String,
  fileSize: String,
  duration: Number,
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timestamp: { type: Date, default: Date.now }
});

// 群组模型
const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: String,
  description: String,
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// 对话模型（用于跟踪最近对话）
const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  type: { type: String, enum: ['private', 'group'], default: 'private' },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  lastActivity: { type: Date, default: Date.now },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  }
});

// 添加索引以提高查询性能
MessageSchema.index({ conversationId: 1, timestamp: -1 });
MessageSchema.index({ senderId: 1, receiverId: 1 });
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastActivity: -1 });

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
const Group = mongoose.model('Group', GroupSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);

module.exports = {
  User,
  Message,
  Group,
  Conversation
};