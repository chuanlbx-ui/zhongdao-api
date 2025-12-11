// 测试积分交易记录性能问题
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

const NORMAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmJhZnZwMGdyZmMzOWloaHI4OWhiZ2IiLCJwaG9uZSI6IjEtNTM5LTM5NC00MDkyIHg4MTk0MCIsInJvbGUiOiJOT1JNQUwiLCJsZXZlbCI6Ik5PUk1BTCIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.w39BrN7-bzoy8m1l0gHxOV7mCKXLoYzr8UESJHuyNo0';

async function testPointsPerformance() {
  console.log('🔍 测试积分交易记录性能问题\n');

  // 测试不同参数
  const testCases = [
    { limit: 1, description: '限制1条记录' },
    { limit: 5, description: '限制5条记录' },
    { limit: 10, description: '限制10条记录' },
    { limit: 20, description: '限制20条记录' },
    { page: 1, description: '第一页' },
    { page: 2, description: '第二页' }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`\n测试: ${testCase.description}`);
      const startTime = Date.now();

      const response = await axios.get(`${API_BASE}/points/transactions`, {
        headers: {
          'Authorization': `Bearer ${NORMAL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params: testCase,
        timeout: 15000
      });

      const duration = Date.now() - startTime;
      console.log(`✅ 成功 (${duration}ms)`);
      console.log(`返回记录数: ${response.data.data?.transactions?.length || 0}`);
      console.log(`总记录数: ${response.data.data?.pagination?.total || 0}`);

      if (duration > 2000) {
        console.log('⚠️ 响应时间超过2秒，可能存在性能问题');
      }

    } catch (error) {
      console.log(`❌ 失败: ${error.message}`);
      if (error.code === 'ECONNABORTED') {
        console.log('⚠️ 请求超时，性能问题严重');
      }
      if (error.response?.data) {
        console.log('错误详情:', error.response.data.error?.message || error.response.data.message);
      }
    }
  }

  // 测试管理员权限
  console.log('\n\n测试管理员权限的交易记录查询:');
  try {
    const adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4bGV4YjM1dmFjMmpxNDB3bmdyMXNmY2EiLCJwaG9uZSI6IjEzODAwMTM4MDAwIiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.d2GwpfY22E09Oilo40AVF-ETp6uewYbbvWLxZKhRYCg';

    const startTime = Date.now();
    const response = await axios.get(`${API_BASE}/points/transactions`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      params: { limit: 10 },
      timeout: 15000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ 管理员查询成功 (${duration}ms)`);
    console.log(`返回记录数: ${response.data.data?.transactions?.length || 0}`);

  } catch (error) {
    console.log(`❌ 管理员查询失败: ${error.message}`);
  }

  // 测试其他积分相关端点
  console.log('\n\n测试其他积分端点:');
  const otherEndpoints = [
    '/points/balance',
    '/points/summary',
    '/points/statistics'
  ];

  for (const endpoint of otherEndpoints) {
    try {
      console.log(`\n测试: ${endpoint}`);
      const startTime = Date.now();

      const response = await axios.get(`${API_BASE}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${NORMAL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      console.log(`✅ 成功 (${duration}ms)`);

    } catch (error) {
      console.log(`❌ 失败: ${error.message}`);
      if (error.response?.status === 404) {
        console.log('端点不存在');
      }
    }
  }
}

testPointsPerformance().catch(console.error);