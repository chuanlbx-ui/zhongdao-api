/**
 * 直接测试积分API响应性
 */

const express = require('express');
const request = require('supertest');

// 加载环境变量
require('dotenv').config({ path: '.env.local' });

// 导入编译后的应用
const app = require('./dist/src/index.js').default;

async function testPointsAPI() {
  console.log('开始直接测试积分API响应性...');

  const startTime = Date.now();

  // 测试列表
  const tests = [
    {
      name: '健康检查',
      path: '/health',
      method: 'get',
      headers: {}
    },
    {
      name: '积分余额（无认证）',
      path: '/api/v1/points/balance',
      method: 'get',
      headers: {}
    },
    {
      name: '积分余额（错误token）',
      path: '/api/v1/points/balance',
      method: 'get',
      headers: { 'Authorization': 'Bearer wrong_token' }
    },
    {
      name: '积分交易记录',
      path: '/api/v1/points/transactions',
      method: 'get',
      headers: { 'Authorization': 'Bearer test_token' }
    },
    {
      name: '积分统计',
      path: '/api/v1/points/statistics',
      method: 'get',
      headers: { 'Authorization': 'Bearer test_token' }
    }
  ];

  for (const test of tests) {
    try {
      console.log(`\n测试: ${test.name}`);
      const testStart = Date.now();

      let req = request(app)[test.method](test.path);

      // 添加headers
      Object.entries(test.headers).forEach(([key, value]) => {
        req = req.set(key, value);
      });

      // 设置超时
      req.timeout(5000);

      const response = await req;
      const duration = Date.now() - testStart;

      console.log(`✅ ${test.name} - 状态码: ${response.status}, 耗时: ${duration}ms`);

      // 如果是积分相关的401，说明路由存在但需要认证
      if (test.path.includes('/points') && response.status === 401) {
        console.log('  → 路由存在，需要认证（正常）');
      }

    } catch (error) {
      const duration = Date.now() - testStart;

      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.timeout) {
        console.log(`❌ ${test.name} - 超时或连接重置 (${duration}ms)`);
        console.log('  → 这是性能问题！需要优化！');
      } else {
        console.log(`❌ ${test.name} - 错误: ${error.message}`);
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`\n测试完成，总耗时: ${totalDuration}ms`);

  process.exit(0);
}

// 先构建项目
console.log('正在构建项目...');
const { execSync } = require('child_process');

try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('构建成功，开始测试...\n');

  // 等待一下让应用初始化
  setTimeout(() => {
    testPointsAPI().catch(error => {
      console.error('测试失败:', error);
      process.exit(1);
    });
  }, 2000);

} catch (error) {
  console.error('构建失败:', error);
  process.exit(1);
}