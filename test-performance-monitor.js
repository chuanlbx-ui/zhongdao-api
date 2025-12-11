/**
 * 性能监控系统测试脚本
 * 用于验证新的性能监控V2系统
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/v1';

// 测试统计
let testStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  responseTimes: [],
  startTime: Date.now()
};

// 测试函数
async function testPerformanceMonitoring() {
  console.log('\n🚀 开始测试性能监控系统 V2\n');

  // 测试1: 基础健康检查
  console.log('1️⃣ 测试健康检查端点...');
  await testEndpoint('/health', 'GET');

  // 测试2: 性能概览
  console.log('\n2️⃣ 测试性能概览端点...');
  await testEndpoint('/performance/health', 'GET');

  // 测试3: 生成一些负载
  console.log('\n3️⃣ 生成测试负载...');
  await generateLoad();

  // 等待数据聚合
  console.log('\n⏳ 等待数据聚合（3秒）...');
  await sleep(3000);

  // 测试4: 再次检查性能数据
  console.log('\n4️⃣ 检查性能统计...');
  await testEndpoint('/performance/health', 'GET');

  // 测试5: 测试需要认证的端点
  console.log('\n5️⃣ 测试慢路由端点（需要认证）...');
  await testEndpoint('/performance/slow-routes', 'GET', { Authorization: 'Bearer invalid-token-for-test' });

  // 输出测试结果
  printTestResults();
}

// 测试单个端点
async function testEndpoint(path, method = 'GET', headers = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path.startsWith('/') ? path : `/${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        testStats.totalRequests++;
        testStats.responseTimes.push(responseTime);

        if (res.statusCode >= 200 && res.statusCode < 400) {
          testStats.successfulRequests++;
          console.log(`   ✅ ${method} ${path} - ${res.statusCode} - ${responseTime}ms`);
        } else {
          testStats.failedRequests++;
          console.log(`   ❌ ${method} ${path} - ${res.statusCode} - ${responseTime}ms`);
        }

        // 显示响应头中的性能信息
        if (res.headers['x-rt']) {
          console.log(`      📊 响应时间: ${res.headers['x-rt']}`);
          console.log(`      📊 采样: ${res.headers['x-sample'] || 'N/A'}`);
        }

        resolve();
      });
    });

    req.on('error', (err) => {
      testStats.totalRequests++;
      testStats.failedRequests++;
      console.log(`   ❌ ${method} ${path} - 错误: ${err.message}`);
      resolve();
    });

    req.end();
  });
}

// 生成测试负载
async function generateLoad() {
  const endpoints = [
    '/health',
    '/api/v1/health',
    '/api/v1/',
    '/api/v1/admin-test'
  ];

  console.log('   并发发送10个请求...');

  const promises = [];
  for (let i = 0; i < 10; i++) {
    const endpoint = endpoints[i % endpoints.length];
    promises.push(testEndpoint(endpoint));

    // 添加小延迟以模拟真实场景
    if (i < 9) {
      await sleep(100);
    }
  }

  await Promise.all(promises);
}

// 打印测试结果
function printTestResults() {
  const duration = Date.now() - testStats.startTime;
  const avgResponseTime = testStats.responseTimes.reduce((a, b) => a + b, 0) / testStats.responseTimes.length;
  const maxResponseTime = Math.max(...testStats.responseTimes);
  const minResponseTime = Math.min(...testStats.responseTimes);

  console.log('\n📊 测试结果统计:');
  console.log('=====================================');
  console.log(`总请求数: ${testStats.totalRequests}`);
  console.log(`成功请求: ${testStats.successfulRequests}`);
  console.log(`失败请求: ${testStats.failedRequests}`);
  console.log(`成功率: ${((testStats.successfulRequests / testStats.totalRequests) * 100).toFixed(2)}%`);
  console.log(`总耗时: ${duration}ms`);
  console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`最快响应时间: ${minResponseTime}ms`);
  console.log(`最慢响应时间: ${maxResponseTime}ms`);
  console.log('=====================================\n');

  console.log('✅ 性能监控系统测试完成！');
  console.log('\n📝 说明:');
  console.log('- 如果看到响应头中的 X-RT 和 X-Sample，说明性能监控正常工作');
  console.log('- 访问 http://localhost:3000/api/v1/performance/health 查看详细性能数据');
  console.log('- 管理员可以访问 /api/v1/performance/overview 获取完整报告');
}

// 工具函数：延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 运行测试
testPerformanceMonitoring().catch(console.error);