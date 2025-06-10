// server/test-db.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

// 用户模型
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  status: { type: String, default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

async function testDatabase() {
  try {
    // 连接数据库
    console.log('正在连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');

    // 创建测试用户
    const testUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: await bcrypt.hash('123456', 10)
    };

    console.log('创建测试用户:', testUser);
    
    // 删除可能存在的旧用户
    await User.deleteOne({ email: testUser.email });
    
    // 创建新用户
    const user = new User(testUser);
    const savedUser = await user.save();
    console.log('✅ 用户保存成功:', savedUser);

    // 查询用户
    const foundUser = await User.findOne({ email: testUser.email });
    console.log('✅ 查询用户成功:', foundUser);

    // 列出所有用户
    const allUsers = await User.find();
    console.log('所有用户:', allUsers);

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    // 关闭连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
  }
}

testDatabase();