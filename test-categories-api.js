#!/usr/bin/env node

/**
 * 测试商品分类API
 */

const request = require('supertest');

// 从环境变量或默认值获取应用URL
const appUrl = process.env.TEST_APP_URL || 'http://localhost:3000';

// 生成token
const jwt = require('jsonwebtoken');
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

const now = Math.floor(Date.now() / 1000);
const token = jwt.sign({
  sub: 'crho9e2hrp50xqkx2um9rbp',
  phone: '13800138001',
  role: 'USER',
  level: 'NORMAL',
  scope: ['active', 'user'],
  type: 'access',
  iat: now,
  exp: now + (7 * 24 * 60 * 60),
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
}, JWT_SECRET);

async function testCategoriesAPI() {
  console.log('测试商品分类API...\n');

  try {
    // 测试1: 获取分类树
    console.log('1. 测试获取分类树...');
    const treeResponse = await request(appUrl)
      .get('/api/v1/products/categories/tree')
      .set('Authorization', `Bearer ${token}`)
      .timeout(5000);

    console.log(`   状态码: ${treeResponse.status}`);
    if (treeResponse.status === 200) {
      console.log(`   成功: 获取到 ${treeResponse.body.data?.categories?.length || 0} 个分类`);
    }

    // 测试2: 获取分类列表（可能卡住的请求）
    console.log('\n2. 测试获取分类列表...');
    const listResponse = await request(appUrl)
      .get('/api/v1/products/categories')
      .query({ page: 1, perPage: 5 })
      .set('Authorization', `Bearer ${token}`)
      .timeout(10000);

    console.log(`   状态码: ${listResponse.status}`);
    if (listResponse.status === 200) {
      console.log(`   成功: 获取到 ${listResponse.body.data?.categories?.length || 0} 个分类`);
    }

  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 先检查服务器是否运行
async function checkServer() {
  try {
    const response = await request(appUrl)
      .get('/health')
      .timeout(2000);

    if (response.status === 200) {
      console.log('服务器运行正常\n');
      await testCategoriesAPI();
    }
  } catch (error) {
    console.error('服务器未运行或无法访问:', error.message);
  }
}

checkServer();