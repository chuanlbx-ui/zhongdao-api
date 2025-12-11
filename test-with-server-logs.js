// 使用fetch并发送快速请求
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/points/transactions?page=1&perPage=5',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4bGV4YjM1dmFjMmpxNDB3bmdyMXNmY2EiLCJzY29wZSI6WyJhY3RpdmUiLCJ1c2VyIl0sInJvbGUiOiJBRE1JTiIsImxldmVsIjoiRElSRUNUT1IiLCJpYXQiOjE3NjUyMTAwNTMsImV4cCI6MTc2NTI5NjQ1MywiYXVkIjoiemhvbmdkYW8tbWFsbC11c2VycyIsImlzcyI6Inpob25nZGFvLW1hbGwifQ.p0L9bbPYbxsWKgWIAEwSSTTyTrOq_qDa7l7ln5u7j1k'
  },
  timeout: 1000  // 1秒超时
};

const startTime = Date.now();
const req = http.request(options, (res) => {
  console.log(`收到响应: ${res.statusCode} (${Date.now() - startTime}ms)`);
  res.on('data', (chunk) => console.log('数据:', chunk.toString()));
  res.on('end', () => process.exit(0));
});

req.on('socket', (socket) => {
  console.log('Socket已连接');
  socket.on('connect', () => console.log('Socket连接建立'));
  socket.on('timeout', () => console.log('Socket超时'));
});

req.on('error', (err) => {
  console.error(`请求错误: ${err.message} (${Date.now() - startTime}ms)`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('请求超时');
  req.destroy();
  process.exit(1);
});

req.end();
console.log('请求已发送');