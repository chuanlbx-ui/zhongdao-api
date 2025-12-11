// 测试积分交易记录API性能 - 使用简化的端点
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/points/transactions/simple',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbiIsInJvbGUiOiJBRE1JTiIsImV4cCI6MTc1NDg1NzU3OX0.E-sBCukEiIUL-lYU0J_n7qkT3tA2LdTJSL5h_GeP3-o',
    'Content-Type': 'application/json'
  }
};

function testAPI() {
  console.log('测试积分交易记录API（简化版）...\n');
  console.time('响应时间');

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.timeEnd('响应时间');
      console.log(`状态码: ${res.statusCode}`);

      try {
        const result = JSON.parse(data);
        if (result.success) {
          console.log(`✅ 请求成功`);
          console.log(`返回记录数: ${result.data?.transactions?.length || 0}`);
          console.log(`总数: ${result.data?.pagination?.total || 0}`);
        } else {
          console.log(`❌ 请求失败: ${result.error?.message}`);
        }
      } catch (e) {
        console.log('响应数据:', data.substring(0, 200));
      }
    });
  });

  req.on('error', (e) => {
    console.error(`请求失败: ${e.message}`);
    console.log('\n请确保开发服务器正在运行：npm run dev');
  });

  req.setTimeout(10000, () => {
    req.destroy();
    console.log('❌ 请求超时（10秒）');
  });

  req.end();
}

// 执行测试
testAPI();