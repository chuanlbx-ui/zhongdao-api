// 直接测试Express应用
const express = require('express');
const cors = require('cors');

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 简单的健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 模拟积分交易API
app.get('/test-transactions', (req, res) => {
  console.log('收到交易查询请求');

  // 模拟快速响应
  setTimeout(() => {
    res.json({
      success: true,
      data: {
        transactions: [],
        pagination: {
          page: 1,
          perPage: 5,
          total: 0,
          totalPages: 0
        }
      }
    });
  }, 100);
});

// 启动服务器
app.listen(3001, () => {
  console.log('测试服务器启动在端口3001');

  // 立即测试
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/test-transactions',
    method: 'GET'
  };

  const startTime = Date.now();
  const req = http.request(options, (res) => {
    console.log(`响应状态: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`响应时间: ${Date.now() - startTime}ms`);
      console.log('响应:', data);
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('请求错误:', err.message);
    process.exit(1);
  });

  req.end();
});