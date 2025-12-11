// 测试简化版交易记录端点
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

const NORMAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmJhZnZwMGdyZmMzOWloaHI4OWhiZ2IiLCJwaG9uZSI6IjEtNTM5LTM5NC00MDkyIHg4MTk0MCIsInJvbGUiOiJOT1JNQUwiLCJsZXZlbCI6Ik5PUk1BTCIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNjY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.w39BrN7-bzoy8m1l0gHxOV7mCKXLoYzr8UESJHuyNo0';

async function testSimpleTransactions() {
  console.log('🔍 测试简化版交易记录端点\n');

  const endpoints = [
    '/points/transactions',
    '/points/transactions/simple',
    '/points/simple',
    '/points/transactions-simple'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`测试: ${endpoint}`);
      const startTime = Date.now();

      const response = await axios.get(`${API_BASE}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${NORMAL_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params: { page: 1, perPage: 5 },
        timeout: 5000
      });

      const duration = Date.now() - startTime;
      console.log(`✅ 成功 (${duration}ms)`);
      if (response.data.data?.transactions) {
        console.log(`返回记录数: ${response.data.data.transactions.length}`);
      }

    } catch (error) {
      console.log(`❌ 失败: ${error.response?.status || error.message}`);
      if (error.response?.data?.error?.message) {
        console.log(`错误: ${error.response.data.error.message}`);
      }
    }
    console.log('---');
  }
}

testSimpleTransactions().catch(console.error);