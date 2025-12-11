#!/usr/bin/env node

/**
 * 快速测试商品API接口
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');

// 配置
const API_BASE = '/api/v1';
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

// 生成测试token
const normalUserToken = jwt.sign({
  sub: 'crho9e2hrp50xqkx2um9rbp',
  phone: '13800138001',
  role: 'USER',
  level: 'NORMAL',
  scope: ['active', 'user'],
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
}, JWT_SECRET);

const adminToken = jwt.sign({
  sub: 'ja4x4705a4emvkga2e73e5ne',
  phone: '13800138888',
  role: 'ADMIN',
  level: 'DIRECTOR',
  scope: ['active', 'user'],
  type: 'access',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
}, JWT_SECRET);

console.log('开始快速测试商品API...\n');

// 从环境变量或默认值获取应用URL
const appUrl = process.env.TEST_APP_URL || 'http://localhost:3000';

// 测试函数
async function testEndpoint(method, path, token, data = null) {
  const startTime = Date.now();

  try {
    const req = request(appUrl)[method.toLowerCase()](path);
    req.set('Authorization', `Bearer ${token}`);

    if (data) {
      req.send(data);
    }

    const response = await req;
    const duration = Date.now() - startTime;

    console.log(`${method.toUpperCase()} ${path}`);
    console.log(`  Status: ${response.status} (${duration}ms)`);

    if (response.status !== 200 && response.status !== 201) {
      console.log(`  Error: ${JSON.stringify(response.body, null, 2)}`);
    } else {
      console.log(`  Success: ${response.body.message || 'OK'}`);
    }

    return response;
  } catch (error) {
    console.error(`${method.toUpperCase()} ${path} - Failed:`, error.message);
    return null;
  }
}

// 测试列表
const tests = [
  // 1. 商品分类
  { method: 'GET', path: `${API_BASE}/products/categories/tree`, token: normalUserToken },
  { method: 'GET', path: `${API_BASE}/products/categories?page=1&perPage=5`, token: normalUserToken },

  // 2. 商品标签
  { method: 'GET', path: `${API_BASE}/products/tags/all`, token: normalUserToken },
  { method: 'GET', path: `${API_BASE}/products/tags?page=1&perPage=5`, token: normalUserToken },
  { method: 'POST', path: `${API_BASE}/products/tags`, token: adminToken,
    data: { name: 'test-tag-' + Date.now(), color: '#FF0000', description: '测试标签' }},

  // 3. 商品列表
  { method: 'GET', path: `${API_BASE}/products/items?page=1&perPage=5`, token: normalUserToken },

  // 4. 商品规格
  { method: 'GET', path: `${API_BASE}/products/specs?page=1&perPage=5`, token: normalUserToken }
];

// 运行测试
async function runTests() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n--- 测试: ${test.path} ---`);
    const response = await testEndpoint(test.method, test.path, test.token, test.data);

    if (response && (response.status === 200 || response.status === 201)) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n=== 测试结果 ===');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${passed + failed}`);
  console.log(`通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
}

// 执行测试
runTests().catch(console.error);