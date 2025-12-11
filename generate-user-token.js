#!/usr/bin/env node

/**
 * 为特定用户生成JWT token
 */

require('dotenv').config({ path: '.env.test' });
const jwt = require('jsonwebtoken');

const userId = 'aiwlm3azfr6ryc2mx64mqo6b'; // 有交易记录的用户

function generateToken() {
  const payload = {
    sub: userId,
    phone: '13800138001',
    role: 'NORMAL',
    level: 'NORMAL',
    scope: ['active', 'user'],
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7天
    jti: `test-token-${Date.now()}`,
    aud: 'zhongdao-mall-users',
    iss: 'zhongdao-mall-test'
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

  console.log('生成的用户Token:');
  console.log('用户ID:', userId);
  console.log('Token:', token);
  console.log('\n使用这个token测试交易API...');

  return token;
}

generateToken();