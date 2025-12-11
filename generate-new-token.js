const jwt = require('jsonwebtoken');

// 使用实际的用户ID
const payload = {
  sub: 'aiwlm3azfr6ryc2mx64mqo6b',
  scope: ['active', 'user'],
  role: 'USER',
  level: 'NORMAL',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时后过期
};

const token = jwt.sign(payload, process.env.JWT_SECRET || 'zhongdao-mall-secret-key-2024', {
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-mall-users'
});

console.log('New JWT Token:');
console.log(token);
console.log('\nUser ID:', payload.sub);