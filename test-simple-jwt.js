// 测试简单的JWT token
require('dotenv').config({ path: '.env' });

const jwt = require('jsonwebtoken');

console.log('🔍 生成简单JWT Token测试');
console.log('JWT Secret:', process.env.JWT_SECRET?.substring(0, 20) + '...');

// 生成最简单的token，只包含必需字段
const simplePayload = {
  sub: 'crho9e2hrp50xqkh2xum9rbp', // 存在的用户ID
  scope: ['active', 'user'],
  role: 'NORMAL',  // 使用level作为role
  level: 'NORMAL',
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7天
  jti: 'test-' + Date.now(),
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
};

const token = jwt.sign(simplePayload, process.env.JWT_SECRET, { algorithm: 'HS256' });
console.log('生成Token:', token.substring(0, 50) + '...');

// 测试curl命令
console.log('\n测试命令:');
console.log(`curl -H "Authorization: Bearer ${token}" "http://localhost:3000/api/v1/products/categories/tree"`);