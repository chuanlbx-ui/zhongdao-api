const http = require('http');

async function getNewToken() {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      phone: '13800138888',
      password: 'admin123456'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 5000
    }, (res) => {
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.data.token) {
            resolve(response.data.token);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function testWithNewToken() {
  console.log('🔐 获取新的管理员token...');

  const token = await getNewToken();

  if (!token) {
    console.log('❌ 无法获取token，服务器可能未运行');
    return;
  }

  console.log('✅ 获取到新token:', token.substring(0, 50) + '...');

  console.log('\n🔍 测试分页查询问题...\n');

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

    const result = await testSingleRequest(test.url, token);

    if (result.success) {
      console.log(`   ✅ 成功 - 状态: ${result.status}, 耗时: ${result.duration}ms, 数据大小: ${result.dataSize}字节`);
      if (result.response) {
        try {
          const parsed = JSON.parse(result.response);
          if (parsed.data && parsed.data.pagination) {
            console.log(`   📄 分页信息: 总数${parsed.data.pagination.total}, 当前页${parsed.data.pagination.page}/${parsed.data.pagination.totalPages}`);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    } else {
      console.log(`   ❌ 失败 - 状态: ${result.status}, 耗时: ${result.duration}ms, 错误: ${result.error}`);
    }
    console.log('');
  }
}

function testSingleRequest(url, token) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    }, (res) => {
      let data = [];

      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const duration = Date.now() - startTime;
        const dataSize = data.reduce((sum, chunk) => sum + chunk.length, 0);
        const response = data.join('');

        resolve({
          success: res.statusCode === 200 && duration < 9000,
          status: res.statusCode,
          duration,
          dataSize,
          response,
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
        response: null,
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
        response: null,
        error: 'TIMEOUT'
      });
    });

    req.end();
  });
}

testWithNewToken().catch(console.error);