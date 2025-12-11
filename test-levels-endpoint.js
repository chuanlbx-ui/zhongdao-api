// 测试等级相关端点
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4bGV4YjM1dmFjMmpxNDB3bmdyMXNmY2EiLCJwaG9uZSI6IjEzODAwMTM4MDAwIiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.d2GwpfY22E09Oilo40AVF-ETp6uewYbbvWLxZKhRYCg';

async function testLevelsEndpoints() {
  console.log('🔍 测试等级相关端点\n');

  const endpoints = [
    '/levels',
    '/levels/me',
    '/levels/system',
    '/users/levels',
    '/users/level-configs'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n测试: ${endpoint}`);
      const response = await axios.get(`${API_BASE}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      console.log('✅ 成功');
      if (response.data.data) {
        console.log('数据类型:', typeof response.data.data);
        if (Array.isArray(response.data.data)) {
          console.log('数组长度:', response.data.data.length);
        }
      }

    } catch (error) {
      console.log('❌ 失败:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('错误:', error.response.data.error?.message || error.response.data.message);
      }
    }
  }
}

testLevelsEndpoints().catch(console.error);