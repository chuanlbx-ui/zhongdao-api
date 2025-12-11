const http = require('http');

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go';

async function testPaginationIssue() {
  console.log('🔍 深度分析分页查询问题...\n');

  // 测试不同的分页参数
  const testCases = [
    { name: '无分页参数', url: '/api/v1/products/categories' },
    { name: '分页第1页', url: '/api/v1/products/categories?page=1&perPage=10' },
    { name: '分页第2页', url: '/api/v1/products/categories?page=2&perPage=10' },
    { name: '大数据量', url: '/api/v1/products/categories?page=1&perPage=100' },
    { name: '小数据量', url: '/api/v1/products/categories?page=1&perPage=1' }
  ];

  for (const test of testCases) {
    console.log(`🚀 测试: ${test.name}`);
    console.log(`   URL: ${test.url}`);

    const result = await testSingleRequest(test.url);

    if (result.success) {
      console.log(`   ✅ 成功 - 状态: ${result.status}, 耗时: ${result.duration}ms, 数据大小: ${result.dataSize}字节`);
    } else {
      console.log(`   ❌ 失败 - 状态: ${result.status}, 耗时: ${result.duration}ms, 错误: ${result.error}`);
    }
    console.log('');
  }
}

function testSingleRequest(url) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000 // 8秒超时，比测试的15秒短
    }, (res) => {
      let data = [];

      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const dataSize = data.reduce((sum, chunk) => sum + chunk.length, 0);

        resolve({
          success: res.statusCode === 200 && duration < 7000,
          status: res.statusCode,
          duration,
          dataSize,
          error: null
        });
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        status: 0,
        duration,
        dataSize: 0,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        success: false,
        status: 0,
        duration,
        dataSize: 0,
        error: 'TIMEOUT'
      });
    });

    req.end();
  });
}

testPaginationIssue().catch(console.error);