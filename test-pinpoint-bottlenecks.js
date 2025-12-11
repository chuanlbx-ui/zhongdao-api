const http = require('http');

const API_BASE = 'http://localhost:3000/api/v1';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go';

async function testSingleAPI(path, name) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1${path}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000 // 5秒超时
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          name,
          path,
          status: res.statusCode,
          duration,
          success: res.statusCode === 200 && duration < 1000,
          error: null
        });
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        name,
        path,
        status: 0,
        duration,
        success: false,
        error: err.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Date.now() - startTime;
      resolve({
        name,
        path,
        status: 0,
        duration,
        success: false,
        error: 'TIMEOUT'
      });
    });

    req.end();
  });
}

async function pinpointBottlenecks() {
  console.log('🎯 精准打击：逐个测试超时API找出瓶颈...\n');

  const tests = [
    { name: '商品分类列表(分页)', path: '/products/categories?page=1&perPage=10' },
    { name: '商品标签列表(分页)', path: '/products/tags?page=1&perPage=10' },
    { name: '商品列表(分页)', path: '/products/items?page=1&perPage=5' },
    { name: '商品规格列表', path: '/products/specs?page=1&perPage=5&productId=cmi4lsy0g0000e2od8es9dx4' }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`🔍 测试: ${test.name}`);
    const result = await testSingleAPI(test.path, test.name);
    results.push(result);

    if (result.success) {
      console.log(`   ✅ 成功 - 状态: ${result.status}, 耗时: ${result.duration}ms`);
    } else {
      console.log(`   ❌ 失败 - 状态: ${result.status}, 耗时: ${result.duration}ms, 错误: ${result.error}`);
    }
    console.log('');

    // 等待一下避免服务器压力过大
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('📊 测试总结:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`   ✅ 成功: ${successful.length}`);
  console.log(`   ❌ 失败: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n🔥 需要紧急优化的API:');
    failed.forEach(f => {
      console.log(`   - ${f.name}: ${f.error} (${f.duration}ms)`);
    });
  }
}

pinpointBottlenecks().catch(console.error);