const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.development' });

const BASE_URL = 'http://localhost:3000';

// 从环境变量获取JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || "92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a";

console.log('=== JWT 认证测试 ===');
console.log('使用 JWT_SECRET:', JWT_SECRET.substring(0, 10) + '...');
console.log('');

// 生成token
const adminToken = jwt.sign({
  sub: 'test-admin-id-12345',
  role: 'ADMIN',
  level: 'DIRECTOR',
  scope: ['active', 'admin', 'read', 'write']
}, JWT_SECRET, {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-users'
});

const userToken = jwt.sign({
  sub: 'test-user-id-12345',
  role: 'USER',
  level: 'NORMAL',
  scope: ['active']
}, JWT_SECRET, {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-users'
});

console.log('生成的管理员Token:', adminToken.substring(0, 50) + '...');
console.log('生成的用户Token:', userToken.substring(0, 50) + '...');
console.log('');

// 测试函数
async function testEndpoint(method, url, token, description) {
  console.log(`=== ${description} ===`);

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers
    });

    const text = await response.text();

    console.log('状态码:', response.status);
    console.log('响应内容:', text);

    if (text.startsWith('{')) {
      try {
        const json = JSON.parse(text);
        console.log('JSON响应:', JSON.stringify(json, null, 2));
      } catch (e) {
        console.log('无法解析为JSON');
      }
    }

    console.log('');
  } catch (error) {
    console.error('请求失败:', error.message);
    console.log('');
  }
}

// 运行测试
async function runTests() {
  // 测试健康检查
  await testEndpoint('GET', '/health', null, '健康检查');

  // 测试管理员认证
  await testEndpoint('GET', '/api/v1/auth/me', adminToken, '管理员认证');

  // 测试用户认证
  await testEndpoint('GET', '/api/v1/auth/me', userToken, '普通用户认证');

  // 测试无认证访问
  await testEndpoint('GET', '/api/v1/auth/me', null, '无认证访问');

  // 测试管理端点
  await testEndpoint('GET', '/api/v1/admin/configs', adminToken, '管理端点访问');

  // 测试API根路径
  await testEndpoint('GET', '/api/v1', null, 'API根路径');

  // 测试另一个端点
  await testEndpoint('GET', '/api/v1/users/profile', adminToken, '用户资料端点');
}

runTests();
