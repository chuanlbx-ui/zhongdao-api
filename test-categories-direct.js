const http = require('http');

// 使用已有的管理员token（已验证可以快速访问categories tree）
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go';

async function testCategoriesList() {
  console.log('🚀 测试商品分类列表API...');

  const startTime = Date.now();

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/products/categories?page=1&perPage=10',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }, (res) => {
    const data = [];

    res.on('data', chunk => data.push(chunk));
    res.on('end', () => {
      const duration = Date.now() - startTime;
      console.log(`响应时间: ${duration}ms`);
      console.log('状态码:', res.statusCode);

      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(data.join(''));
          console.log('响应成功，数据量:', JSON.stringify(response).length);
        } catch (e) {
          console.log('响应解析失败:', data.slice(0, 200));
        }
      } else {
        console.log('错误响应:', data.slice(0, 200));
      }
    });
  });

  req.on('error', (err) => {
    console.error('请求错误:', err.message);
    console.log(`总耗时: ${Date.now() - startTime}ms`);
  });

  req.end();
}

testCategoriesList();