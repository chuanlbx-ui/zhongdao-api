const jwt = require('jsonwebtoken');

// 使用有效的密钥
const secret = 'your-256-bit-secret-key-0123456789abcd';

// 创建管理员token
const adminToken = jwt.sign(
  {
    sub: 'admin-user-id',
    scope: ['active', 'user'],
    role: 'ADMIN',
    level: 'DIRECTOR'
  },
  secret,
  {
    expiresIn: '24h',
    audience: 'zhongdao-mall-users',
    issuer: 'zhongdao-mall'
  }
);

console.log('新管理员Token:');
console.log(adminToken);
console.log('\n测试命令:');
console.log(`curl -H "Authorization: Bearer ${adminToken}" "http://localhost:3000/api/v1/points/balance"`);