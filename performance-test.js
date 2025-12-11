/**
 * 性能测试脚本
 * 测试系统核心功能的响应时间
 */

const { performance } = require('perf_hooks');

async function testEndpoint(name, url) {
  console.log(`\n测试 ${name}...`);
  const start = performance.now();

  try {
    const response = await fetch(url);
    const end = performance.now();

    if (response.ok) {
      console.log(`✓ ${name} - 响应时间: ${(end - start).toFixed(2)}ms`);
    } else {
      console.log(`✗ ${name} - 状态码: ${response.status}`);
    }
  } catch (error) {
    console.log(`✗ ${name} - 错误: ${error.message}`);
  }
}

async function runPerformanceTests() {
  console.log('中道商城系统 - 性能测试');
  console.log('========================');

  const baseUrl = 'http://localhost:3000';

  // 基础端点测试
  await testEndpoint('健康检查', `${baseUrl}/health`);
  await testEndpoint('API根路径', `${baseUrl}/api/v1`);
  await testEndpoint('认证信息', `${baseUrl}/api/v1/auth/me`);

  // 用户相关
  await testEndpoint('用户列表', `${baseUrl}/api/v1/users`);

  // 产品相关
  await testEndpoint('产品模块', `${baseUrl}/api/v1/products`);
  await testEndpoint('产品分类', `${baseUrl}/api/v1/products/categories`);

  // 店铺相关
  await testEndpoint('店铺模块', `${baseUrl}/api/v1/shops`);

  // 订单相关
  await testEndpoint('订单模块', `${baseUrl}/api/v1/orders`);

  // 佣金相关
  await testEndpoint('佣金模块', `${baseUrl}/api/v1/commission`);

  // 积分相关
  await testEndpoint('积分模块', `${baseUrl}/api/v1/points`);

  // 团队相关
  await testEndpoint('团队模块', `${baseUrl}/api/v1/teams`);

  console.log('\n测试完成！');
}

// 运行测试
runPerformanceTests().catch(console.error);