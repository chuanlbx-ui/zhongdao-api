// 直接测试API性能
const fetch = require('node-fetch');

async function testAPI() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4bGV4YjM1dmFjMmpxNDB3bmdyMXNmY2EiLCJzY29wZSI6WyJhY3RpdmUiLCJ1c2VyIl0sInJvbGUiOiJBRE1JTiIsImxldmVsIjoiRElSRUNUT1IiLCJpYXQiOjE3NjUyMTAwNTMsImV4cCI6MTc2NTI5NjQ1MywiYXVkIjoiemhvbmdkYW8tbWFsbC11c2VycyIsImlzcyI6Inpob25nZGFvLW1hbGwifQ.p0L9bbPYbxsWKgWIAEwSSTTyTrOq_qDa7l7ln5u7j1k';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    console.log('测试交易记录API...');
    const start = Date.now();

    const response = await fetch('http://localhost:3000/api/v1/points/transactions?page=1&perPage=5', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    console.log(`响应状态: ${response.status}`);
    console.log(`响应时间: ${Date.now() - start}ms`);

    if (response.ok) {
      const data = await response.json();
      console.log('响应数据:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log('错误信息:', error);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('请求失败:', error.message);
  }
}

testAPI();