// server/routes/friends.js
const express = require('express');
const router = express.Router();
const { User, Message, Conversation } = require('../models');

// 搜索用户（添加好友时使用）
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user.userId;

    if (!query) {
      return res.json([]);
    }

    // 搜索用户名或邮箱
    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // 排除自己
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).select('username email avatar status').limit(10);

    res.json(users);
  } catch (error) {
    console.error('搜索用户错误:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 发送好友请求
router.post('/request', async (req, res) => {
  try {
    const { targetUserId, message } = req.body;
    const currentUserId = req.user.userId;

    // 检查是否已经是好友
    const currentUser = await User.findById(currentUserId);
    if (currentUser.friends.some(f => f.userId.toString() === targetUserId)) {
      return res.status(400).json({ error: '已经是好友了' });
    }

    // 检查是否已有待处理的请求
    const targetUser = await User.findById(targetUserId);
    const existingRequest = targetUser.friendRequests.find(
      r => r.from.toString() === currentUserId && r.status === 'pending'
    );

    if (existingRequest) {
      return res.status(400).json({ error: '已发送过好友请求' });
    }

    // 添加好友请求
    targetUser.friendRequests.push({
      from: currentUserId,
      message: message || '我想加你为好友',
      status: 'pending'
    });

    await targetUser.save();

    // 通过 Socket.io 实时通知
    const io = req.app.get('io');
    const targetSocketId = req.app.get('userSockets').get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:request', {
        from: {
          _id: currentUser._id,
          username: currentUser.username,
          avatar: currentUser.avatar
        },
        message
      });
    }

    res.json({ success: true, message: '好友请求已发送' });
  } catch (error) {
    console.error('发送好友请求错误:', error);
    res.status(500).json({ error: '发送失败' });
  }
});

// 获取好友请求列表
router.get('/requests', async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    const user = await User.findById(currentUserId)
      .populate('friendRequests.from', 'username email avatar');
    
    const pendingRequests = user.friendRequests.filter(r => r.status === 'pending');
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('获取好友请求错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 处理好友请求
router.post('/request/:requestId/:action', async (req, res) => {
  try {
    const { requestId, action } = req.params;
    const currentUserId = req.user.userId;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: '无效的操作' });
    }

    const currentUser = await User.findById(currentUserId);
    const request = currentUser.friendRequests.id(requestId);

    if (!request) {
      return res.status(404).json({ error: '请求不存在' });
    }

    request.status = action === 'accept' ? 'accepted' : 'rejected';

    if (action === 'accept') {
      // 互相添加为好友
      const otherUser = await User.findById(request.from);
      
      currentUser.friends.push({ userId: request.from });
      otherUser.friends.push({ userId: currentUserId });
      
      await otherUser.save();
      
      // 创建对话
      const conversationId = [currentUserId, request.from.toString()].sort().join('-');
      await Conversation.findOneAndUpdate(
        { participants: { $all: [currentUserId, request.from] } },
        {
          participants: [currentUserId, request.from],
          type: 'private',
          lastActivity: new Date()
        },
        { upsert: true }
      );

      // 通知对方
      const io = req.app.get('io');
      const otherSocketId = req.app.get('userSockets').get(request.from.toString());
      if (otherSocketId) {
        io.to(otherSocketId).emit('friend:accepted', {
          user: {
            _id: currentUser._id,
            username: currentUser.username,
            avatar: currentUser.avatar
          }
        });
      }
    }

    await currentUser.save();
    
    res.json({ 
      success: true, 
      message: action === 'accept' ? '已添加好友' : '已拒绝请求' 
    });
  } catch (error) {
    console.error('处理好友请求错误:', error);
    res.status(500).json({ error: '处理失败' });
  }
});

// 获取好友列表
router.get('/list', async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    const user = await User.findById(currentUserId)
      .populate('friends.userId', 'username email avatar status lastSeen');
    
    res.json(user.friends);
  } catch (error) {
    console.error('获取好友列表错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取对话列表
router.get('/conversations', async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    const conversations = await Conversation.find({
      participants: currentUserId
    })
    .populate('participants', 'username email avatar status')
    .populate('lastMessage')
    .sort('-lastActivity')
    .limit(50);
    
    // 格式化对话数据
    const formattedConversations = conversations.map(conv => {
      const otherUser = conv.participants.find(p => p._id.toString() !== currentUserId);
      return {
        id: conv._id,
        user: otherUser,
        lastMessage: conv.lastMessage,
        lastActivity: conv.lastActivity,
        unreadCount: conv.unreadCount.get(currentUserId) || 0,
        type: conv.type
      };
    });
    
    res.json(formattedConversations);
  } catch (error) {
    console.error('获取对话列表错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 发送消息
router.post('/message', async (req, res) => {
  try {
    const { receiverId, content, type = 'text', replyTo } = req.body;
    const senderId = req.user.userId;
    
    // 创建对话ID
    const conversationId = [senderId, receiverId].sort().join('-');
    
    // 保存消息
    const message = new Message({
      senderId,
      receiverId,
      conversationId,
      type,
      content,
      replyTo
    });
    
    await message.save();
    
    // 更新对话
    const conversation = await Conversation.findOneAndUpdate(
      { participants: { $all: [senderId, receiverId] } },
      {
        lastMessage: message._id,
        lastActivity: new Date(),
        $inc: { [`unreadCount.${receiverId}`]: 1 }
      },
      { new: true, upsert: true }
    );
    
    // 通过 Socket.io 发送实时消息
    const io = req.app.get('io');
    const receiverSocketId = req.app.get('userSockets').get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message:receive', {
        ...message.toObject(),
        sender: await User.findById(senderId).select('username avatar')
      });
      
      // 更新消息状态为已送达
      message.status = 'delivered';
      await message.save();
    }
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({ error: '发送失败' });
  }
});

// 获取消息历史
router.get('/messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;
    
    const conversationId = [currentUserId, userId].sort().join('-');
    
    const messages = await Message.find({
      conversationId,
      deletedFor: { $ne: currentUserId }
    })
    .populate('replyTo')
    .sort('-timestamp')
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    // 标记消息为已读
    await Message.updateMany(
      {
        conversationId,
        receiverId: currentUserId,
        status: { $ne: 'read' }
      },
      { status: 'read' }
    );
    
    // 清除未读计数
    await Conversation.updateOne(
      { participants: { $all: [currentUserId, userId] } },
      { [`unreadCount.${currentUserId}`]: 0 }
    );
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('获取消息历史错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;