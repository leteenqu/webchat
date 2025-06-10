// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

// 创建 Express 应用
const app = express();
const server = http.createServer(app);

// 配置
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Socket.io 配置
const io = socketIO(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 中间件
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB 连接
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB 连接成功');
}).catch(err => {
  console.error('❌ MongoDB 连接失败:', err);
});

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
    message: { type: String, default: '我想加你为好友' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// 消息模型
const MessageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  receiverId: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  status: { type: String, default: 'sent' },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', MessageSchema);

// JWT 验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ===== API 路由 =====

// 健康检查
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Chat server is running',
    timestamp: new Date().toISOString()
  });
});

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  console.log('📝 收到注册请求:', req.body);
  
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '请填写所有字段' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();
    console.log('✅ 用户注册成功:', email);

    res.json({ 
      success: true,
      message: '注册成功' 
    });
  } catch (error) {
    console.error('❌ 注册错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  console.log('🔑 收到登录请求:', req.body.email);
  
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: '邮箱或密码错误' });
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ 用户登录成功:', email);

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('❌ 登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// AI 聊天接口
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  console.log('🤖 收到AI聊天请求');
  
  try {
    const { messages } = req.body;
    
    // 如果有 DeepSeek API 密钥
    if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here') {
      console.log('使用 DeepSeek API...');
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个友好、智能的AI助手。请用简洁清晰的中文回复用户的问题。' },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 1000
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return res.json({
        success: true,
        message: response.data.choices[0].message.content
      });
    }
    
    // 模拟响应
    console.log('使用模拟AI响应...');
    const userMessage = messages[messages.length - 1]?.content || '';
    
    let response = '你好！我是AI助手。';
    
    // 根据用户消息生成不同的回复
    if (userMessage.includes('你好') || userMessage.includes('Hi')) {
      response = '你好！很高兴见到你。有什么我可以帮助你的吗？';
    } else if (userMessage.includes('天气')) {
      response = '抱歉，我暂时无法获取实时天气信息。建议你查看天气预报应用。';
    } else if (userMessage.includes('帮助') || userMessage.includes('help')) {
      response = '我可以帮你：\n1. 回答各种问题\n2. 提供建议和想法\n3. 协助写作和编程\n4. 进行有趣的对话\n\n请告诉我你需要什么帮助！';
    } else if (userMessage.includes('是谁') || userMessage.includes('介绍')) {
      response = '我是AI助手，一个基于人工智能的对话系统。我被设计来帮助用户解答问题、提供信息和进行友好的对话。';
    } else {
      const responses = [
        '这是一个很有意思的问题！让我想想...',
        '我理解你的意思。从我的角度来看...',
        '感谢你的提问！关于这个话题，我认为...',
        '这确实值得深入探讨。',
        '很高兴和你讨论这个话题！'
      ];
      response = responses[Math.floor(Math.random() * responses.length)];
    }
    
    // 添加延迟以模拟思考
    setTimeout(() => {
      res.json({
        success: true,
        message: response
      });
    }, 1000);
    
  } catch (error) {
    console.error('AI聊天错误:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'AI服务暂时不可用',
      message: '抱歉，AI助手暂时无法响应。请稍后再试。' 
    });
  }
});

// 搜索用户
app.get('/api/friends/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user.userId;

    console.log('搜索用户:', query, '当前用户ID:', currentUserId);

    if (!query || query.trim() === '') {
      return res.json([]);
    }

    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    }).select('username email avatar status').limit(10);

    console.log('搜索结果:', users.length, '个用户');
    res.json(users);
  } catch (error) {
    console.error('搜索用户错误:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 发送好友请求
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, message } = req.body;
    const currentUserId = req.user.userId;
    
    console.log('发送好友请求:', currentUserId, '->', targetUserId);
    
    // 检查是否已经是好友
    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 检查是否已经是好友
    const alreadyFriends = currentUser.friends.some(f => 
      f.userId.toString() === targetUserId
    );
    
    if (alreadyFriends) {
      return res.status(400).json({ error: '已经是好友了' });
    }
    
    // 检查是否已有待处理的请求
    const existingRequest = targetUser.friendRequests.find(req => 
      req.from.toString() === currentUserId && req.status === 'pending'
    );
    
    if (existingRequest) {
      return res.status(400).json({ error: '已发送过好友请求' });
    }
    
    // 添加好友请求到目标用户
    targetUser.friendRequests.push({
      from: currentUserId,
      message: message || '我想加你为好友',
      status: 'pending'
    });
    
    await targetUser.save();
    console.log('✅ 好友请求已发送');
    
    // 通过 Socket.io 实时通知
    const targetSocketId = connectedUsers.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend:request', {
        from: {
          _id: currentUser._id,
          username: currentUser.username,
          email: currentUser.email,
          avatar: currentUser.avatar
        },
        message: message || '我想加你为好友'
      });
    }
    
    res.json({ success: true, message: '好友请求已发送' });
  } catch (error) {
    console.error('发送好友请求错误:', error);
    res.status(500).json({ error: '发送失败' });
  }
});

// 获取好友请求列表
app.get('/api/friends/requests', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    const user = await User.findById(currentUserId)
      .populate('friendRequests.from', 'username email avatar');
    
    const pendingRequests = user.friendRequests.filter(req => 
      req.status === 'pending'
    );
    
    console.log(`用户 ${currentUserId} 有 ${pendingRequests.length} 个待处理请求`);
    res.json(pendingRequests);
  } catch (error) {
    console.error('获取好友请求错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 处理好友请求（接受/拒绝）
app.post('/api/friends/request/:requestId/:action', authenticateToken, async (req, res) => {
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
    
    if (request.status !== 'pending') {
      return res.status(400).json({ error: '请求已处理' });
    }
    
    request.status = action === 'accept' ? 'accepted' : 'rejected';
    
    if (action === 'accept') {
      // 互相添加为好友
      const otherUser = await User.findById(request.from);
      
      // 添加到好友列表
      currentUser.friends.push({ userId: request.from });
      otherUser.friends.push({ userId: currentUserId });
      
      await otherUser.save();
      
      // 通知对方
      const otherSocketId = connectedUsers.get(request.from.toString());
      if (otherSocketId) {
        io.to(otherSocketId).emit('friend:accepted', {
          user: {
            _id: currentUser._id,
            username: currentUser.username,
            email: currentUser.email,
            avatar: currentUser.avatar
          }
        });
      }
      
      console.log(`✅ ${currentUser.username} 和 ${otherUser.username} 成为好友`);
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
app.get('/api/friends/list', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    const user = await User.findById(currentUserId)
      .populate('friends.userId', 'username email avatar status lastSeen');
    
    const friends = user.friends.map(f => f.userId);
    
    console.log(`用户 ${currentUserId} 有 ${friends.length} 个好友`);
    res.json(friends);
  } catch (error) {
    console.error('获取好友列表错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 修改获取对话列表，只显示好友
app.get('/api/friends/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    
    // 获取用户的好友列表
    const user = await User.findById(currentUserId)
      .populate('friends.userId', 'username email avatar status lastSeen');
    
    if (!user) {
      return res.json([]);
    }
    
    // 获取每个好友的最后一条消息
    const conversationsWithMessages = await Promise.all(
      user.friends.map(async (friend) => {
        const friendUser = friend.userId;
        if (!friendUser) return null;
        
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: currentUserId, receiverId: friendUser._id.toString() },
            { senderId: friendUser._id.toString(), receiverId: currentUserId }
          ]
        }).sort('-timestamp');
        
        return {
          id: friendUser._id,
          user: friendUser,
          lastMessage: lastMessage ? {
            content: lastMessage.content,
            timestamp: lastMessage.timestamp
          } : null,
          lastActivity: lastMessage ? lastMessage.timestamp : friend.addedAt,
          unreadCount: 0,
          type: 'private'
        };
      })
    );
    
    // 过滤掉null值并按最后活动时间排序
    const validConversations = conversationsWithMessages
      .filter(conv => conv !== null)
      .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    console.log(`返回 ${validConversations.length} 个对话`);
    res.json(validConversations);
  } catch (error) {
    console.error('获取对话列表错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取对话列表
app.get('/api/friends/conversations', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    console.log('获取对话列表，用户ID:', currentUserId);
    
    // 查找所有注册用户（除了自己）作为潜在对话
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select('username email avatar status lastSeen')
      .limit(20);
    
    // 获取每个用户的最后一条消息
    const conversationsWithMessages = await Promise.all(users.map(async (user) => {
      const lastMessage = await Message.findOne({
        $or: [
          { senderId: currentUserId, receiverId: user._id.toString() },
          { senderId: user._id.toString(), receiverId: currentUserId }
        ]
      }).sort('-timestamp');
      
      return {
        id: user._id,
        user: user,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp
        } : null,
        lastActivity: lastMessage ? lastMessage.timestamp : new Date(),
        unreadCount: 0,
        type: 'private'
      };
    }));
    
    // 只返回有消息往来的对话
    const activeConversations = conversationsWithMessages.filter(conv => conv.lastMessage);
    
    console.log('返回对话数:', activeConversations.length);
    res.json(activeConversations);
  } catch (error) {
    console.error('获取对话列表错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 发送消息
app.post('/api/friends/message', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content, type = 'text' } = req.body;
    const senderId = req.user.userId;
    
    console.log('发送消息:', { senderId, receiverId, content });
    
    const message = new Message({
      senderId,
      receiverId,
      content,
      type
    });
    
    await message.save();
    console.log('✅ 消息已保存');
    
    // 通过 Socket.io 发送实时消息（如果接收者在线）
    const receiverSocketId = io.sockets.adapter.rooms.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverId).emit('message:receive', {
        ...message.toObject(),
        sender: await User.findById(senderId).select('username avatar')
      });
    }
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({ error: '发送失败' });
  }
});

// 获取消息历史
app.get('/api/friends/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    console.log('获取消息历史:', currentUserId, '<->', userId);
    
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: userId },
        { senderId: userId, receiverId: currentUserId }
      ]
    }).sort('timestamp').limit(100);
    
    console.log(`返回 ${messages.length} 条消息`);
    res.json(messages);
  } catch (error) {
    console.error('获取消息历史错误:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 在文件顶部添加
const connectedUsers = new Map();

// 更新 Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('👤 新连接:', socket.id);

  // 认证处理
  socket.on('auth', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;
      
      // 保存用户连接信息
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      
      // 加入用户专属房间（用于接收消息）
      socket.join(userId);
      
      // 更新用户在线状态
      await User.findByIdAndUpdate(userId, { 
        status: 'online',
        lastSeen: new Date()
      });
      
      console.log(`✅ 用户 ${userId} 已认证并加入房间`);
      
      // 通知好友上线
      const user = await User.findById(userId).populate('friends.userId');
      if (user && user.friends) {
        user.friends.forEach(friend => {
          if (friend.userId) {
            const friendSocketId = connectedUsers.get(friend.userId._id.toString());
            if (friendSocketId) {
              io.to(friendSocketId).emit('friend:online', {
                userId: userId,
                status: 'online'
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('❌ Socket认证失败:', error);
      socket.emit('auth:error', '认证失败');
    }
  });

  // 发送消息（实时）
  /*
  socket.on('message:send', async (data) => {
    try {
      const { receiverId, content, type = 'text' } = data;
      const senderId = socket.userId;
      
      if (!senderId) {
        return socket.emit('error', '未认证');
      }
      
      console.log('📤 实时消息:', senderId, '->', receiverId);
      
      // 保存消息到数据库
      const message = new Message({
        senderId,
        receiverId,
        content,
        type,
        status: 'sent'
      });
      
      await message.save();
      
      // 获取发送者信息
      const sender = await User.findById(senderId).select('username avatar');
      
      // 发送给接收者
      const receiverSocketId = connectedUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:receive', {
          _id: message._id,
          senderId,
          receiverId,
          content,
          type,
          timestamp: message.timestamp,
          sender: sender,
          status: 'delivered'
        });
        
        // 更新消息状态为已送达
        message.status = 'delivered';
        await message.save();
        
        console.log('✅ 消息已送达');
      } else {
        console.log('⏸️ 接收者离线，消息已保存');
      }
      
      // 发送确认给发送者
      socket.emit('message:sent', {
        _id: message._id,
        status: message.status,
        timestamp: message.timestamp
      });
      
    } catch (error) {
      console.error('❌ 发送消息错误:', error);
      socket.emit('error', '发送失败');
    }
  });
  */

  // 断开连接
  socket.on('disconnect', async () => {
    if (socket.userId) {
      // 更新用户离线状态
      await User.findByIdAndUpdate(socket.userId, { 
        status: 'offline',
        lastSeen: new Date()
      });
      
      // 通知好友离线
      const user = await User.findById(socket.userId).populate('friends.userId');
      if (user && user.friends) {
        user.friends.forEach(friend => {
          if (friend.userId) {
            const friendSocketId = connectedUsers.get(friend.userId._id.toString());
            if (friendSocketId) {
              io.to(friendSocketId).emit('friend:offline', {
                userId: socket.userId,
                status: 'offline',
                lastSeen: new Date()
              });
            }
          }
        });
      }
      
      connectedUsers.delete(socket.userId);
      console.log(`👤 用户 ${socket.userId} 断开连接`);
    }
  });
});

// 更新发送消息的 API（确保也通过 Socket 发送）
app.post('/api/friends/message', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content, type = 'text' } = req.body;
    const senderId = req.user.userId;
    
    console.log('💬 API发送消息:', senderId, '->', receiverId);
    
    const message = new Message({
      senderId,
      receiverId,
      content,
      type
    });
    
    await message.save();
    
    // 获取发送者信息
    const sender = await User.findById(senderId).select('username avatar');
    
    // 通过 Socket.io 发送实时消息
    const receiverSocketId = connectedUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message:receive', {
        _id: message._id,
        senderId,
        receiverId,
        content,
        type,
        timestamp: message.timestamp,
        sender: sender
      });
      
      message.status = 'delivered';
      await message.save();
    }
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('发送消息错误:', error);
    res.status(500).json({ error: '发送失败' });
  }
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`\n🚀 服务器启动成功！`);
  console.log(`📡 服务器地址: http://localhost:${PORT}`);
  console.log(`🗄️  数据库: ${MONGODB_URI}`);
  console.log(`🌐 允许的客户端: ${CLIENT_URL}`);
  console.log(`🤖 DeepSeek API: ${process.env.DEEPSEEK_API_KEY ? '已配置' : '未配置(使用模拟)'}\n`);
});