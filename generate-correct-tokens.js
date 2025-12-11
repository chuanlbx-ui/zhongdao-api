// 生成正确的JWT token
const jwt = require('jsonwebtoken');

const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

// 从数据库获取的正确用户信息
const users = [
  {
    id: 'ja4x4705a4emvkga2e73e5ne', // 管理员
    phone: '13800138888',
    level: 'DIRECTOR',
    scope: ['active', 'user']
  },
  {
    id: 'crho9e2hrp50xqkh2xum9rbp', // 普通用户
    phone: '13800138001',
    level: 'NORMAL',
    scope: ['active', 'user']
  }
];

function generateToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    phone: user.phone,
    role: user.level, // 使用level作为role
    level: user.level,
    scope: user.scope,
    type: 'access',
    iat: now,
    exp: now + (24 * 60 * 60), // 24小时
    aud: 'zhongdao-mall-users',
    iss: 'zhongdao-mall-test'
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

console.log('🔑 生成正确的JWT Token:\n');

users.forEach(user => {
  const token = generateToken(user);
  console.log(`${user.level}用户 (${user.phone}):`);
  console.log(`ID: ${user.id}`);
  console.log(`Token: ${token}`);
  console.log('---');
});

// 直接输出可用的token
const adminToken = generateToken(users[0]);
const normalToken = generateToken(users[1]);

console.log('\n📋 测试文件中使用的Token:');
console.log(`管理员Token: '${adminToken}'`);
console.log(`普通用户Token: '${normalToken}'`);