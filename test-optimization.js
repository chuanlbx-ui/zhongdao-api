/**
 * 优化效果测试
 */

const axios = require('axios');

// API基础配置
const API_BASE_URL = 'http://localhost:3000/api/v1';
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${USER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 45000 // 增加超时以让请求完成
});

async function testEndpoint(name, method, path, params = {}) {
  console.log(`\n📍 测试: ${name}`);
  console.log(`   ${method} ${path}`);
  
  const startTime = Date.now();
  
  try {
    const response = method === 'GET' 
      ? await client.get(path, { params })
      : await client.post(path, params);
    
    const duration = Date.now() - startTime;
    const status = response.status;
    const dataSize = JSON.stringify(response.data).length;
    
    console.log(`   ✅ 成功 (${status}, ${duration}ms, ${(dataSize/1024).toFixed(2)}KB)`);
    
    return { name, duration, status, success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.code === 'ECONNABORTED') {
      console.log(`   ❌ 超时 (>${duration}ms)`);
    } else if (error.response) {
      console.log(`   ⚠️  错误: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }
    
    return { name, duration, status: error.response?.status || 0, success: false };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 API优化效果测试 - 关键端点性能验证');
  console.log('='.repeat(60));
  
  const endpoints = [
    {
      name: 'GET /orders - 订单列表',
      method: 'GET',
      path: '/orders',
      params: { page: 1, perPage: 20 }
    },
    {
      name: 'GET /commission/statistics - 佣金统计',
      method: 'GET',
      path: '/commission/statistics',
      params: {}
    },
    {
      name: 'GET /inventory/logs - 库存日志',
      method: 'GET',
      path: '/inventory/logs',
      params: { page: 1, perPage: 20 }
    }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(
      endpoint.name,
      endpoint.method,
      endpoint.path,
      endpoint.params
    );
    results.push(result);
    
    // 每个请求之间休息1秒
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const avgDuration = results.length > 0 ? totalDuration / results.length : 0;
  
  console.log(`✅ 成功: ${successCount}/${results.length}`);
  console.log(`⏱️  平均响应时间: ${avgDuration.toFixed(2)}ms`);
  console.log(`⏱️  总耗时: ${totalDuration}ms`);
  
  console.log('\n详细结果:');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.name.padEnd(40)} ${r.duration}ms`);
  });
  
  // 性能评级
  console.log('\n🎯 性能评级:');
  if (avgDuration < 1000) {
    console.log('🟢 优秀 - 所有API响应快速');
  } else if (avgDuration < 5000) {
    console.log('🟡 良好 - 响应时间可接受');
  } else if (avgDuration < 10000) {
    console.log('🟠 一般 - 响应时间较慢');
  } else {
    console.log('🔴 较差 - 响应时间很慢或超时');
  }
  
  console.log('\n' + '='.repeat(60));
  process.exit(successCount === results.length ? 0 : 1);
}

runTests().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
