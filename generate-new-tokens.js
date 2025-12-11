// 加载环境变量
require('dotenv').config({ path: '.env.test' });

const jwt = require('jsonwebtoken');

// 从环境变量读取JWT secret
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

console.log('🔐 生成新的JWT Token');
console.log('JWT Secret:', JWT_SECRET?.substring(0, 20) + '...');
console.log('JWT_EXPIRES_IN:', JWT_EXPIRES_IN);

// 用户数据（从数据库中查询到的正确用户ID）
const users = [
  {
    id: 'crho9e2hrp50xqkh2xum9rbp', // 普通用户
    phone: '13800138001',
    level: 'NORMAL',
    scope: ['active', 'user']
  },
  {
    id: 'ja4x4705a4emvkga2e73e5ne', // 管理员
    phone: '13800138888',
    level: 'DIRECTOR',
    scope: ['active', 'user']
  }
];

// 生成新的tokens
users.forEach((user, index) => {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    sub: user.id,
    phone: user.phone,
    role: user.level, // 使用level作为role
    level: user.level,
    scope: user.scope,
    type: 'access',
    iat: now,
    exp: now + (7 * 24 * 60 * 60), // 7天
    jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
    aud: 'zhongdao-mall-users',
    iss: 'zhongdao-mall-test'
  };

  try {
    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      algorithm: 'HS256'
    });

    console.log(`\n✅ 用户${index + 1} (${user.level}):`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Token: ${token}`);
    console.log(`   Phone: ${user.phone}`);

    // 验证刚生成的token
    const verified = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    console.log(`   ✅ 验证成功: ${verified.sub}`);

  } catch (error) {
    console.log(`❌ 生成用户${index + 1}的token失败:`, error.message);
  }
});

console.log('\n🎯 复制这些token到测试文件中测试...');