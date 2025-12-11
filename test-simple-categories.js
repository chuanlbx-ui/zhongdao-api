const http = require('http');

// 最简单的测试 - 不带认证
async function testSimpleCategories() {
  console.log('🔍 测试最简单的商品分类请求（无认证）...');

  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/products/categories?page=1&perPage=10',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go'
      },
      timeout: 3000 // 3秒超时
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`响应状态: ${res.statusCode}`);
        console.log(`响应时间: ${duration}ms`);
        console.log('响应数据:', data.slice(0, 200));
        resolve({
          status: res.statusCode,
          duration,
          success: res.statusCode === 200 && duration < 1000
        });
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`请求错误: ${err.message}`);
      console.log(`耗时: ${duration}ms`);
      resolve({
        status: 0,
        duration,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      console.log(`请求超时: ${duration}ms`);
      resolve({
        status: 0,
        duration,
        success: false,
        error: 'TIMEOUT'
      });
    });

    req.end();
  });
}

testSimpleCategories().then(result => {
  console.log('\n测试结果:', result.success ? '✅ 成功' : '❌ 失败');
}).catch(console.error);