import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, Search, Send, Smile, X, User, Lock, Mail, Eye, EyeOff, LogOut,
  Paperclip, Mic, MicOff, File, Download, Phone, Video, MoreVertical,
  Check, CheckCheck, Users, Plus, Settings, Shield, Bell,
  Star, Forward, Reply, Copy, Trash2, UserPlus, Volume2,
  VideoOff, PhoneOff, Monitor
} from 'lucide-react';
import io from 'socket.io-client';

const ChatApp = () => {
  // 状态管理
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [activeTab, setActiveTab] = useState('chats');
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState({
    'ai-assistant': [
      { id: 1, text: '你好！我是AI助手，有什么可以帮助你的吗？', sender: 'ai', time: '14:30', status: 'read' },
      { id: 2, text: '我可以帮你解答问题、提供建议、协助写作、编程指导等。随时告诉我你需要什么帮助！', sender: 'ai', time: '14:30', status: 'read' },
    ],
    1: [
      { id: 1, text: '在吗？😊', sender: 'other', senderName: '张三', time: '14:30', status: 'read' },
      { id: 2, text: '在的，有什么事吗？', sender: 'me', time: '14:32', status: 'read' },
      { id: 3, type: 'image', url: '/api/placeholder/300/200', sender: 'other', senderName: '张三', time: '14:33', status: 'read' },
      { id: 4, text: '晚上一起吃饭吧 🍜', sender: 'other', senderName: '张三', time: '14:33', status: 'read' },
    ],
    'group-1': [
      { id: 1, text: '大家好！👋', sender: 'other', senderName: '李四', time: '09:00', status: 'read' },
      { id: 2, text: '早上好！今天的会议几点？', sender: 'other', senderName: '王五', time: '09:05', status: 'read' },
      { id: 3, text: '10点在会议室A', sender: 'me', time: '09:06', status: 'read' },
      { id: 4, text: '收到，谢谢！', sender: 'other', senderName: '王五', time: '09:07', status: 'read' },
    ],
  });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: '', members: [] });
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState(true);
  const [friendRequests, setFriendRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [aiConversationContext, setAiConversationContext] = useState([]);
  
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const recordingInterval = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);

  // 表情符号列表
  const emojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌',
    '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑',
    '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
    '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
    '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟',
    '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
    '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
    '🎉', '🎊', '🎈', '🎁', '🎂', '🍰', '🍕', '🍔', '🍟', '🌭', '🍿', '🍜'
  ];

  // 添加通知函数（在您的其他函数定义之后添加）
const showNotification = (title, body, icon = null) => {
  // 检查浏览器是否支持通知
  if ('Notification' in window) {
    // 如果尚未授权，请求权限
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: icon || '/favicon.ico', // 使用您的应用图标
        tag: 'wechat-message' // 防止重复通知
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body: body,
            icon: icon || '/favicon.ico',
            tag: 'wechat-message'
          });
        }
      });
    }
  }
};

  // 联系人和群组列表 - 整合真实对话数据
  const [chats, setChats] = useState([
    { 
      id: 'ai-assistant', 
      type: 'ai',
      name: 'AI助手', 
      avatar: '🤖', 
      lastMessage: '你好！我是AI助手，有什么可以帮助你的吗？', 
      time: '现在', 
      unread: 0, 
      online: true,
      pinned: true,
      isAI: true
    }
  ]);

  // 更新聊天列表 - 从对话数据生成
  useEffect(() => {
    if (conversations.length > 0) {
      const newChats = conversations.map(conv => ({
        id: conv.user._id,
        userId: conv.user._id, // 真实用户ID
        type: 'private',
        name: conv.user.username,
        avatar: conv.user.username[0].toUpperCase(),
        lastMessage: conv.lastMessage ? conv.lastMessage.content : '开始聊天吧',
        time: conv.lastActivity ? new Date(conv.lastActivity).toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '现在',
        unread: conv.unreadCount || 0,
        online: conv.user.status === 'online',
        lastSeen: conv.user.lastSeen,
        pinned: false
      }));
      
      setChats(prev => {
        // 保留AI助手，添加真实对话
        const aiChat = prev.find(c => c.id === 'ai-assistant');
        return aiChat ? [aiChat, ...newChats] : newChats;
      });
    }
  }, [conversations]);

  // 播放提示音
  const playNotificationSound = () => {
    try {
      // 创建一个简单的提示音
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.error('播放提示音失败:', error);
    }
  };

  // 更新页面标题显示未读数
  const updatePageTitle = () => {
    const totalUnread = chats.reduce((sum, chat) => sum + (chat.unread || 0), 0);
    setUnreadTotal(totalUnread);
    document.title = totalUnread > 0 ? `(${totalUnread}) 聊天应用` : '聊天应用';
  };

  // 监听聊天列表变化，更新未读数
  useEffect(() => {
    updatePageTitle();
  }, [chats]);

  // 选择聊天时标记已读
  useEffect(() => {
    if (selectedChat && selectedChat !== 'ai-assistant') {
      // 清除当前聊天的未读数
      setChats(prev => prev.map(chat => {
        if (chat.id === selectedChat || chat.userId === selectedChat) {
          return { ...chat, unread: 0 };
        }
        return chat;
      }));
      
      // 加载消息历史
      const chat = chats.find(c => c.id === selectedChat);
      if (chat && chat.userId) {
        loadMessages(chat.userId);
      }
    }
  }, [selectedChat]);

  // 所有用户列表（用于创建群组）
  const allUsers = [
    { id: 1, name: '张三', avatar: '张' },
    { id: 2, name: '李四', avatar: '李' },
    { id: 3, name: '王五', avatar: '王' },
    { id: 4, name: '赵六', avatar: '赵' },
    { id: 5, name: '产品经理', avatar: '产' },
    { id: 6, name: '设计师', avatar: '设' },
  ];

  // 初始化 Socket.io 连接
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      // 创建 Socket 连接
      const socket = io('http://localhost:3001', {
        transports: ['websocket'],
        auth: {
          token: localStorage.getItem('token')
        }
      });
      
      socketRef.current = socket;
      
      // 连接成功
      socket.on('connect', () => {
        console.log('Socket 连接成功');
        // 发送认证信息
        socket.emit('auth', localStorage.getItem('token'));
      });
      
      // 接收实时消息
      socket.on('message:receive', (messageData) => {
        console.log('收到新消息:', messageData);
        
        const senderId = messageData.senderId || messageData.sender?._id;
        
        // 更新消息列表
        setMessages(prev => {
          return {
            ...prev,
            [senderId]: [...(prev[senderId] || []), {
              id: messageData._id || Date.now(),
              text: messageData.content,
              type: messageData.type || 'text',
              sender: 'other',
              senderName: messageData.sender?.username,
              time: new Date(messageData.timestamp).toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              status: 'received'
            }]
          };
        });
        
        // 更新聊天列表的最后消息和未读数
        setChats(prev => prev.map(chat => {
          if (chat.id === senderId || chat.userId === senderId) {
            const isCurrentChat = selectedChat === chat.id || selectedChat === senderId;
            return {
              ...chat,
              lastMessage: messageData.content,
              time: new Date(messageData.timestamp).toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              unread: isCurrentChat ? 0 : (chat.unread || 0) + 1
            };
          }
          return chat;
        }));
        
        // 更新页面标题显示未读数
        updatePageTitle();
        
        // 播放提示音（如果不是当前聊天）
        if (selectedChat !== senderId && selectedChat !== messageData.senderId) {
          playNotificationSound();
          
          // 显示浏览器通知
          const senderName = messageData.sender?.username || '好友';
          showNotification(
            senderName,
            messageData.content,
            messageData.sender?.avatar
          );
        }
      });
      
      // 接收好友请求
      socket.on('friend:request', (data) => {
        console.log('收到好友请求:', data);
        loadFriendRequests();
      });
      
      // 好友接受请求
      socket.on('friend:accepted', (data) => {
        console.log('好友请求被接受:', data);
        loadConversations();
      });
      
      // 加载初始数据
      loadConversations();
      loadFriendRequests();
      
      // 定期检查好友请求
      const interval = setInterval(() => {
        loadFriendRequests();
      }, 30000); // 每30秒检查一次
      
      // 清理函数
      return () => {
        clearInterval(interval);
        socket.disconnect();
      };
    }
  }, [isLoggedIn, currentUser, selectedChat]);

  // 加载对话列表
  const loadConversations = async () => {
    try {
      const response = await fetch('/api/friends/conversations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('加载对话失败:', error);
    }
  };

  // 加载好友请求
  const loadFriendRequests = async () => {
    try {
      const response = await fetch('/api/friends/requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('加载好友请求失败:', error);
    }
  };

  // 搜索用户
  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/friends/search?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    }
  };

  // 发送好友请求
  const sendFriendRequest = async (targetUserId) => {
    try {
      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          targetUserId,
          message: '我想加你为好友'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('好友请求已发送');
        setSearchResults([]);
        setSearchQuery('');
      } else {
        alert(data.error || '发送失败');
      }
    } catch (error) {
      console.error('发送好友请求失败:', error);
      alert('发送失败');
    }
  };

  // 处理好友请求
  const handleFriendRequest = async (requestId, action) => {
    try {
      const response = await fetch(`/api/friends/request/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert(data.message);
        loadFriendRequests();
        loadConversations();
      } else {
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('处理好友请求失败:', error);
      alert('操作失败');
    }
  };

  // 加载消息历史
  const loadMessages = async (userId) => {
    try {
      const response = await fetch(`/api/friends/messages/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => ({
          ...prev,
          [userId]: data.map(msg => ({
            id: msg._id,
            text: msg.content,
            type: msg.type,
            sender: msg.senderId === currentUser.id ? 'me' : 'other',
            time: new Date(msg.timestamp).toLocaleTimeString('zh-CN', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            status: msg.status
          }))
        }));
      }
    } catch (error) {
      console.error('加载消息失败:', error);
    }
  };

  // 登录处理
  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginForm.email,
          password: loginForm.password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 保存 token
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        setCurrentUser(data.user);
        setIsLoggedIn(true);
      } else {
        alert(data.error || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      alert('登录失败，请检查网络连接');
    }
  };

  // 注册处理
  const handleRegister = async () => {
    console.log('开始注册，表单数据:', registerForm);
    
    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      alert('请填写所有字段');
      return;
    }
    
    if (registerForm.password !== registerForm.confirmPassword) {
      alert('两次输入的密码不一致！');
      return;
    }
    
    if (registerForm.password.length < 6) {
      alert('密码长度至少6位！');
      return;
    }
    
    try {
      console.log('发送注册请求到:', '/api/auth/register');
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password
        })
      });

      console.log('响应状态:', response.status);
      const data = await response.json();
      console.log('响应数据:', data);

      if (response.ok && data.success) {
        alert('注册成功！请登录');
        setIsRegistering(false);
        setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
        // 自动填充登录表单
        setLoginForm({ email: registerForm.email, password: '' });
      } else {
        alert(data.error || '注册失败，请重试');
      }
    } catch (error) {
      console.error('注册请求失败:', error);
      alert('注册失败：' + error.message);
    }
  };

  // 退出登录
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  // 发送消息到AI助手
  const sendToAI = async (userMessage) => {
    // 显示AI正在输入
    setIsAITyping(true);
    
    // 添加用户消息到上下文
    const newContext = [...aiConversationContext, { role: 'user', content: userMessage }];
    setAiConversationContext(newContext);
    
    try {
      // 模拟API调用 - 实际使用时替换为真实的API端点
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          messages: newContext,
          model: 'deepseek-v1',
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error('AI服务暂时不可用');
      }
      
      const data = await response.json();
      const aiReply = data.message || data.choices?.[0]?.message?.content || '抱歉，我暂时无法回复。';
      
      // 添加AI回复到消息列表
      const aiMessage = {
        id: Date.now(),
        text: aiReply,
        sender: 'ai',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };
      
      setMessages(prev => ({
        ...prev,
        'ai-assistant': [...(prev['ai-assistant'] || []), aiMessage]
      }));
      
      // 更新上下文
      setAiConversationContext([...newContext, { role: 'assistant', content: aiReply }]);
      
      // 更新最后消息
      setChats(prev => prev.map(chat => 
        chat.id === 'ai-assistant' 
          ? { ...chat, lastMessage: aiReply, time: aiMessage.time }
          : chat
      ));
      
    } catch (error) {
      console.error('AI请求失败:', error);
      
      // 发送错误消息
      const errorMessage = {
        id: Date.now(),
        text: '抱歉，AI服务暂时出现问题。请稍后再试。',
        sender: 'ai',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        status: 'read'
      };
      
      setMessages(prev => ({
        ...prev,
        'ai-assistant': [...(prev['ai-assistant'] || []), errorMessage]
      }));
    } finally {
      setIsAITyping(false);
    }
  };

  // 发送消息到服务器
  const sendMessageToServer = async (receiverId, messageText) => {
    try {
      const response = await fetch('/api/friends/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          receiverId,
          content: messageText,
          type: 'text'
        })
      });
      
      if (!response.ok) {
        throw new Error('发送失败');
      }
      
      // 不需要重复通过 Socket 发送，因为服务器 API 已经会通过 Socket 转发
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (message.trim() && selectedChat) {
      const currentChat = chats.find(c => c.id === selectedChat);
      
      // 如果是真实用户，发送到服务器
      if (currentChat && currentChat.userId) {
        try {
          await sendMessageToServer(currentChat.userId, message);
        } catch (error) {
          alert('消息发送失败');
          return;
        }
      }
      
      const newMessage = {
        id: Date.now(),
        text: message,
        sender: 'me',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        replyTo: replyingTo
      };
      
      setMessages(prev => ({
        ...prev,
        [selectedChat]: [...(prev[selectedChat] || []), newMessage]
      }));
      
      // 更新最后消息
      setChats(prev => prev.map(chat => 
        chat.id === selectedChat 
          ? { ...chat, lastMessage: message, time: newMessage.time }
          : chat
      ));
      
      const messageText = message; // 保存消息内容
      setMessage('');
      setShowEmojiPicker(false);
      setReplyingTo(null);
      
      // 如果是AI助手，发送到AI
      if (selectedChat === 'ai-assistant') {
        await sendToAI(messageText);
      }
    }
  };

  // 更新消息状态
  const updateMessageStatus = (chatId, messageId, status) => {
    setMessages(prev => ({
      ...prev,
      [chatId]: prev[chatId].map(msg => 
        msg.id === messageId ? { ...msg, status } : msg
      )
    }));
  };

  // 创建群组
  const handleCreateGroup = () => {
    if (groupForm.name.trim() && groupForm.members.length > 0) {
      const newGroup = {
        id: `group-${Date.now()}`,
        type: 'group',
        name: groupForm.name,
        avatar: groupForm.name[0],
        lastMessage: '群组已创建',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        unread: 0,
        members: groupForm.members.length + 1,
        pinned: false
      };
      
      setChats(prev => [newGroup, ...prev]);
      setMessages(prev => ({
        ...prev,
        [newGroup.id]: [{
          id: 1,
          text: `${currentUser.username} 创建了群组`,
          sender: 'system',
          time: newGroup.time
        }]
      }));
      
      setShowGroupModal(false);
      setGroupForm({ name: '', members: [] });
    }
  };

  // 开始视频通话
  const startVideoCall = async () => {
    setShowVideoCall(true);
    setCallStatus('正在连接...');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setCallStatus('正在呼叫...');
      
      setTimeout(() => {
        setCallStatus('通话中');
      }, 2000);
    } catch (error) {
      console.error('获取摄像头失败:', error);
      setCallStatus('无法访问摄像头');
    }
  };

  // 结束通话
  const endCall = () => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setShowVideoCall(false);
    setCallStatus('');
    setIsMuted(false);
    setIsVideoOff(false);
  };

  // 消息操作
  const handleMessageAction = (action, msg) => {
    switch (action) {
      case 'reply':
        setReplyingTo(msg);
        setShowMessageMenu(null);
        break;
      case 'forward':
        alert('转发功能开发中...');
        break;
      case 'copy':
        navigator.clipboard.writeText(msg.text || '');
        alert('已复制到剪贴板');
        break;
      case 'delete':
        setMessages(prev => ({
          ...prev,
          [selectedChat]: prev[selectedChat].filter(m => m.id !== msg.id)
        }));
        break;
      case 'star':
        alert('已收藏消息');
        break;
    }
    setShowMessageMenu(null);
  };

  // 置顶聊天
  const togglePinChat = (chatId) => {
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat
    ).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    }));
  };

  // 搜索消息
  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 登录/注册界面
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-400 to-blue-500">
        <div className="bg-white p-8 rounded-lg shadow-xl w-96">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold">
              {isRegistering ? '创建账户' : '欢迎回来'}
            </h2>
          </div>
          
          {isRegistering ? (
            <div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <User className="inline w-4 h-4 mr-1" />
                  用户名
                </label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <Mail className="inline w-4 h-4 mr-1" />
                  邮箱
                </label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  确认密码
                </label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <button
                onClick={() => {
                  console.log('注册表单数据:', registerForm);
                  handleRegister();
                }}
                className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200"
              >
                注册
              </button>
              
              <p className="text-center mt-4 text-sm">
                已有账户？
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="text-green-500 hover:underline ml-1"
                >
                  立即登录
                </button>
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <Mail className="inline w-4 h-4 mr-1" />
                  邮箱
                </label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="user@example.com"
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  <Lock className="inline w-4 h-4 mr-1" />
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="123456"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleLogin}
                className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600 transition duration-200"
              >
                登录
              </button>
              
              <div className="flex items-center justify-between mt-4">
                <label className="flex items-center text-sm">
                  <input type="checkbox" className="mr-2" />
                  记住我
                </label>
                <a href="#" className="text-sm text-green-500 hover:underline">
                  忘记密码？
                </a>
              </div>
              
              <p className="text-center mt-4 text-sm">
                还没有账户？
                <button
                  type="button"
                  onClick={() => setIsRegistering(true)}
                  className="text-green-500 hover:underline ml-1"
                >
                  立即注册
                </button>
              </p>
              
              <div className="mt-4 text-center text-xs text-gray-500">
                测试账号：user@example.com / 123456
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 主界面
  return (
    <div className="flex h-screen bg-gray-100">
      {/* 隐藏的文件输入 */}
      <input ref={fileInputRef} type="file" className="hidden" />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" />

      {/* 添加好友模态框 */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">添加好友</h3>
              <button
                onClick={() => {
                  setShowAddFriend(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="搜索用户名或邮箱"
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(user => (
                  <div key={user._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-3">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => sendFriendRequest(user._id)}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                    >
                      添加
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {searchQuery && searchResults.length === 0 && (
              <p className="text-center text-gray-500">没有找到用户</p>
            )}
          </div>
        </div>
      )}

      {/* 好友请求通知 */}
      {friendRequests.length > 0 && (
        <div className="fixed top-4 right-4 bg-white rounded-lg shadow-lg p-4 w-80 z-50">
          <h4 className="font-bold mb-2">好友请求 ({friendRequests.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {friendRequests.map(request => (
              <div key={request._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center flex-1">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-bold mr-2">
                    {request.from.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{request.from.username}</p>
                    <p className="text-xs text-gray-500">{request.message}</p>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleFriendRequest(request._id, 'accept')}
                    className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleFriendRequest(request._id, 'reject')}
                    className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 创建群组模态框 */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">创建群组</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">群组名称</label>
              <input
                type="text"
                value={groupForm.name}
                onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="输入群组名称"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择成员</label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
                {allUsers.map(user => (
                  <label key={user.id} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupForm.members.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGroupForm({...groupForm, members: [...groupForm.members, user.id]});
                        } else {
                          setGroupForm({...groupForm, members: groupForm.members.filter(id => id !== user.id)});
                        }
                      }}
                      className="mr-3"
                    />
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                      {user.avatar}
                    </div>
                    <span>{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupForm.name || groupForm.members.length === 0}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 视频通话界面 */}
      {showVideoCall && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex-1 relative">
            <video
              ref={remoteVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
            />
            
            <video
              ref={localVideoRef}
              className="absolute top-4 right-4 w-48 h-36 object-cover rounded-lg shadow-lg"
              autoPlay
              playsInline
              muted
            />
            
            <div className="absolute top-4 left-4 text-white">
              <h3 className="text-xl font-semibold">{chats.find(c => c.id === selectedChat)?.name}</h3>
              <p className="text-sm">{callStatus}</p>
            </div>
          </div>
          
          <div className="bg-gray-900 p-4">
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-4 rounded-full ${isMuted ? 'bg-red-500' : 'bg-gray-700'} text-white`}
              >
                {isMuted ? <MicOff /> : <Mic />}
              </button>
              <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={`p-4 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-gray-700'} text-white`}
              >
                {isVideoOff ? <VideoOff /> : <Video />}
              </button>
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-500 text-white"
              >
                <PhoneOff />
              </button>
              <button className="p-4 rounded-full bg-gray-700 text-white">
                <Monitor />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 设置界面 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold mb-4">设置</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Bell className="w-5 h-5 mr-2" />
                  <span>通知</span>
                </div>
                <button
                  onClick={() => setNotifications(!notifications)}
                  className={`w-12 h-6 rounded-full ${notifications ? 'bg-green-500' : 'bg-gray-300'} relative transition-colors`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  <span>端到端加密</span>
                </div>
                <span className="text-green-500 text-sm">已启用</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  <span>个人资料</span>
                </div>
                <button className="text-blue-500 text-sm hover:underline">编辑</button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Volume2 className="w-5 h-5 mr-2" />
                  <span>消息提示音</span>
                </div>
                <button className="text-blue-500 text-sm hover:underline">更改</button>
              </div>
              
              <div className="pt-4 border-t">
                <button className="text-red-500 text-sm hover:underline">清除聊天记录</button>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 左侧边栏 */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* 用户信息栏 */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold mr-3">
              {currentUser?.username?.[0] || 'U'}
            </div>
            <div>
              <h3 className="font-medium">{currentUser?.username || '用户'}</h3>
              <p className="text-xs text-gray-500">{currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {unreadTotal > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                  {unreadTotal}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="退出登录"
            >
              <LogOut className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索聊天"
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* 标签栏 */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-3 text-center ${activeTab === 'chats' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('chats')}
          >
            聊天
          </button>
          <button
            className={`flex-1 py-3 text-center ${activeTab === 'contacts' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('contacts')}
          >
            通讯录
          </button>
          <button
            className={`flex-1 py-3 text-center ${activeTab === 'groups' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('groups')}
          >
            群组
          </button>
        </div>

        {/* 添加好友按钮 */}
        {activeTab === 'contacts' && (
          <button
            onClick={() => setShowAddFriend(true)}
            className="w-full p-4 flex items-center justify-center text-green-600 hover:bg-gray-50 border-b"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            添加好友
          </button>
        )}

        {/* 聊天列表 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'groups' && (
            <button
              onClick={() => setShowGroupModal(true)}
              className="w-full p-4 flex items-center justify-center text-green-600 hover:bg-gray-50"
            >
              <Plus className="w-5 h-5 mr-2" />
              创建群组
            </button>
          )}
          
          {filteredChats
            .filter(chat => {
              if (activeTab === 'groups') return chat.type === 'group';
              if (activeTab === 'contacts') return chat.type === 'private';
              return true;
            })
            .map(chat => (
            <div
              key={chat.id}
              className={`flex items-center p-4 hover:bg-gray-50 cursor-pointer ${selectedChat === chat.id ? 'bg-gray-100' : ''}`}
              onClick={() => setSelectedChat(chat.id)}
            >
              <div className="relative">
                <div className={`w-12 h-12 rounded-full ${
                  chat.type === 'group' ? 'bg-blue-500' : 
                  chat.type === 'ai' ? 'bg-purple-500' : 'bg-green-500'
                } flex items-center justify-center text-white font-bold`}>
                  {chat.type === 'group' ? <Users className="w-6 h-6" /> : 
                   chat.type === 'ai' ? chat.avatar : chat.avatar}
                </div>
                {chat.online && chat.type === 'private' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                )}
                {chat.type === 'ai' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-purple-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
              </div>
              <div className="flex-1 ml-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <h3 className="font-medium text-gray-900">{chat.name}</h3>
                    {chat.type === 'group' && (
                      <span className="ml-2 text-xs text-gray-500">({chat.members}人)</span>
                    )}
                    {chat.type === 'ai' && (
                      <span className="ml-2 text-xs text-purple-500">AI</span>
                    )}
                    {chat.pinned && <Star className="w-4 h-4 text-yellow-500 ml-2" />}
                  </div>
                  <span className="text-xs text-gray-500">{chat.time}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {selectedChat === chat.id && isAITyping && chat.type === 'ai' 
                    ? '正在输入...' 
                    : chat.lastMessage
                  }
                </p>
              </div>
              {chat.unread > 0 && (
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold animate-pulse">
                  {chat.unread > 99 ? '99+' : chat.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧聊天区域 */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* 聊天头部 */}
          <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full ${
                  chats.find(c => c.id === selectedChat)?.type === 'group' ? 'bg-blue-500' : 
                  chats.find(c => c.id === selectedChat)?.type === 'ai' ? 'bg-purple-500' : 'bg-green-500'
                } flex items-center justify-center text-white font-bold`}>
                  {chats.find(c => c.id === selectedChat)?.type === 'group' 
                    ? <Users className="w-5 h-5" /> 
                    : chats.find(c => c.id === selectedChat)?.type === 'ai'
                    ? chats.find(c => c.id === selectedChat)?.avatar
                    : chats.find(c => c.id === selectedChat)?.avatar
                  }
                </div>
                {chats.find(c => c.id === selectedChat)?.online && chats.find(c => c.id === selectedChat)?.type === 'private' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                )}
                {chats.find(c => c.id === selectedChat)?.type === 'ai' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-purple-400 rounded-full border-2 border-white animate-pulse"></div>
                )}
              </div>
              <div className="ml-3">
                <h2 className="font-medium text-lg">
                  {chats.find(c => c.id === selectedChat)?.name}
                </h2>
                <p className="text-xs text-gray-500">
                  {chats.find(c => c.id === selectedChat)?.type === 'group'
                    ? `${chats.find(c => c.id === selectedChat)?.members} 位成员`
                    : chats.find(c => c.id === selectedChat)?.type === 'ai'
                    ? isAITyping ? 'AI正在思考...' : 'AI助手 • 始终在线'
                    : chats.find(c => c.id === selectedChat)?.online 
                      ? '在线' 
                      : `最后上线: ${chats.find(c => c.id === selectedChat)?.lastSeen}`
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => togglePinChat(selectedChat)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <Star className={`w-5 h-5 ${chats.find(c => c.id === selectedChat)?.pinned ? 'text-yellow-500' : 'text-gray-600'}`} />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={startVideoCall}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <Video className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 消息区域 */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {messages[selectedChat]?.map(msg => (
              <div key={msg.id}>
                {/* 系统消息 */}
                {msg.sender === 'system' && (
                  <div className="text-center my-4">
                    <span className="text-xs text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
                      {msg.text}
                    </span>
                  </div>
                )}
                
                {/* 普通消息 */}
                {msg.sender !== 'system' && (
                  <div className={`flex mb-4 ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className="relative group">
                      {/* AI助手标识 */}
                      {msg.sender === 'ai' && (
                        <div className="flex items-center mb-1">
                          <span className="text-xs text-purple-600 font-medium">AI助手</span>
                        </div>
                      )}
                      
                      {/* 消息内容 */}
                      <div
                        className={`max-w-xs ${
                          msg.sender === 'me'
                            ? 'bg-green-500 text-white'
                            : msg.sender === 'ai' 
                            ? 'bg-purple-500 text-white'
                            : 'bg-white text-gray-900'
                        } rounded-lg overflow-hidden`}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setShowMessageMenu(msg.id);
                        }}
                      >
                        {/* 回复的消息 */}
                        {msg.replyTo && (
                          <div className={`px-3 py-2 ${msg.sender === 'me' ? 'bg-green-600' : 'bg-gray-100'} border-l-4 border-green-700`}>
                            <p className="text-xs opacity-70">{msg.replyTo.senderName || '你'}</p>
                            <p className="text-sm truncate">{msg.replyTo.text}</p>
                          </div>
                        )}
                        
                        {/* 群组发送者名称 */}
                        {chats.find(c => c.id === selectedChat)?.type === 'group' && msg.sender !== 'me' && (
                          <p className="px-3 pt-2 text-xs text-green-600 font-medium">{msg.senderName}</p>
                        )}
                        
                        {/* 消息主体 */}
                        {msg.type === 'image' ? (
                          <img src={msg.url} alt="图片" className="w-full h-auto cursor-pointer hover:opacity-90" />
                        ) : msg.type === 'file' ? (
                          <div className="flex items-center p-3 space-x-3">
                            <File className="w-8 h-8 text-gray-400" />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{msg.fileName}</p>
                              <p className="text-xs opacity-70">{msg.fileSize}</p>
                            </div>
                            <Download className="w-5 h-5 cursor-pointer hover:opacity-70" />
                          </div>
                        ) : msg.type === 'voice' ? (
                          <div className="flex items-center p-3 space-x-3">
                            <Mic className="w-5 h-5" />
                            <div className="flex-1 h-1 bg-gray-300 rounded-full">
                              <div className="h-full w-1/3 bg-gray-600 rounded-full"></div>
                            </div>
                            <span className="text-xs">{msg.duration}s</span>
                          </div>
                        ) : (
                          <div className="px-4 py-2">
                            <p>{msg.text}</p>
                          </div>
                        )}
                        
                        {/* 时间和状态 */}
                        <div className={`flex items-center justify-between px-3 pb-1 text-xs ${
                          msg.sender === 'me' ? 'text-green-100' : 
                          msg.sender === 'ai' ? 'text-purple-100' : 'text-gray-500'
                        }`}>
                          <span>{msg.time}</span>
                          {msg.sender === 'me' && msg.status && (
                            <span className="ml-2">
                              {msg.status === 'sent' && <Check className="w-3 h-3 inline" />}
                              {msg.status === 'delivered' && <CheckCheck className="w-3 h-3 inline" />}
                              {msg.status === 'read' && <CheckCheck className="w-3 h-3 inline text-blue-300" />}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 消息菜单 */}
                      {showMessageMenu === msg.id && (
                        <div className="absolute z-10 bg-white rounded-lg shadow-lg py-2 mt-1">
                          <button
                            onClick={() => handleMessageAction('reply', msg)}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 w-full text-left"
                          >
                            <Reply className="w-4 h-4 mr-2" />
                            回复
                          </button>
                          <button
                            onClick={() => handleMessageAction('forward', msg)}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 w-full text-left"
                          >
                            <Forward className="w-4 h-4 mr-2" />
                            转发
                          </button>
                          <button
                            onClick={() => handleMessageAction('copy', msg)}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 w-full text-left"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            复制
                          </button>
                          <button
                            onClick={() => handleMessageAction('star', msg)}
                            className="flex items-center px-4 py-2 hover:bg-gray-100 w-full text-left"
                          >
                            <Star className="w-4 h-4 mr-2" />
                            收藏
                          </button>
                          {msg.sender === 'me' && (
                            <button
                              onClick={() => handleMessageAction('delete', msg)}
                              className="flex items-center px-4 py-2 hover:bg-gray-100 w-full text-left text-red-500"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              删除
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {/* AI正在输入提示 */}
            {selectedChat === 'ai-assistant' && isAITyping && (
              <div className="flex justify-start mb-4">
                <div className="bg-purple-500 text-white rounded-lg px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <span className="text-sm">AI正在思考...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 输入区域 */}
          <div className="bg-white p-4 border-t border-gray-200">
            {/* 回复提示 */}
            {replyingTo && (
              <div className="mb-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">回复 {replyingTo.senderName || '自己'}</p>
                  <p className="text-sm truncate">{replyingTo.text}</p>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* 表情选择器 */}
            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 bg-white rounded-lg shadow-xl p-4 w-96 max-h-64 overflow-y-auto z-10">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">选择表情</h3>
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-1">
                  {emojis.map((emoji, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setMessage(prev => prev + emoji);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <button 
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
              >
                <Paperclip className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                className="p-2 hover:bg-gray-100 rounded-full"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="w-5 h-5 text-gray-600" />
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="输入消息..."
                className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {message.trim() ? (
                <button
                  onClick={handleSendMessage}
                  className="p-2 bg-green-500 hover:bg-green-600 rounded-full text-white"
                >
                  <Send className="w-5 h-5" />
                </button>
              ) : (
                <button className="p-2 bg-green-500 hover:bg-green-600 rounded-full text-white">
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">选择一个聊天开始对话</p>
            <p className="text-sm text-gray-400 mt-2">或创建新的群组开始群聊</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatApp;