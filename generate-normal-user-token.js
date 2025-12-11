// 加载环境变量
require('dotenv').config({ path: '.env' });

const jwt = require('jsonwebtoken');

// 从环境变量读取JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

console.log('🔐 生成普通用户Token');

// 普通用户数据（从数据库中查询到的正确用户ID）
const normalUser = {
  id: 'crho9e2hrp50xqkh2xum9rbp', // 普通用户
  phone: '13800138001',
  level: 'NORMAL',
  scope: ['active', 'user']
};

const now = Math.floor(Date.now() / 1000);
const tokenPayload = {
  sub: normalUser.id,
  phone: normalUser.phone,
  role: normalUser.level,
  level: normalUser.level,
  scope: normalUser.scope,
  type: 'access',
  iat: now,
  exp: now + (7 * 24 * 60 * 60), // 7天
  jti: Math.random().toString(36).substring(2) + Date.now().toString(36),
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
};

// 生成token
console.log('🚀 生成普通用户新token...');
const newUserToken = jwt.sign(tokenPayload, JWT_SECRET, { algorithm: 'HS256' });
console.log('普通用户Token:', newUserToken);
console.log('Token用户ID:', tokenPayload.sub);

// 立即验证
console.log('\n🔍 立即验证...');
try {
  const verified = jwt.verify(newUserToken, JWT_SECRET, { algorithms: ['HS256'] });
  console.log('✅ 验证成功:', verified.sub);
  console.log('用户级别:', verified.level);
} catch (error) {
  console.log('❌ 验证失败:', error.message);
}