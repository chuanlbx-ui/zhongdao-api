// 测试enhancedInputValidation优化效果
require('dotenv').config({ path: '.env' });

const http = require('http');

console.log('🔍 测试enhancedInputValidation优化效果');
console.log('=====================================\n');

// 有效JWT Token
const VALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go';

// 测试不同大小的请求体
const testCases = [
  {
    name: '空请求体',
    body: '{}',
    expectedTime: '< 100ms'
  },
  {
    name: '小请求体',
    body: JSON.stringify({ name: 'test', category: 'electronics' }),
    expectedTime: '< 100ms'
  },
  {
    name: '中等请求体',
    body: JSON.stringify({
      name: 'test product'.repeat(10),
      description: 'A'.repeat(1000),
      details: { features: 'B'.repeat(2000) }
    }),
    expectedTime: '< 200ms'
  },
  {
    name: '大请求体',
    body: JSON.stringify({
      name: 'large product'.repeat(100),
      description: 'C'.repeat(10000),
      details: {
        features: 'D'.repeat(20000),
        specifications: 'E'.repeat(30000)
      }
    }),
    expectedTime: '< 500ms'
  }
];

async function makeRequest(body) {
  return new Promise((resolve, reject) => {
    const postData = body;

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/products/categories?page=1&perPage=10',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VALID_TOKEN}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('开始测试不同请求体的性能...\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`📊 测试 ${i + 1}: ${testCase.name} (${testCase.body.length} 字符)`);

    try {
      const startTime = Date.now();
      const response = await makeRequest(testCase.body);
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`   状态码: ${response.statusCode}`);
      console.log(`   响应时间: ${duration}ms (期望: ${testCase.expectedTime})`);

      if (duration > 1000) {
        console.log(`   🚨 警告: 响应时间过长！`);
      } else if (duration > 500) {
        console.log(`   ⚠️  注意: 响应时间较慢`);
      } else {
        console.log(`   ✅ 响应时间正常`);
      }

      // 检查响应是否成功
      if (response.statusCode === 200) {
        try {
          const responseData = JSON.parse(response.body);
          if (responseData.success) {
            console.log(`   ✅ API响应成功`);
          } else {
            console.log(`   ❌ API响应失败: ${responseData.error}`);
          }
        } catch (parseError) {
          console.log(`   ⚠️  响应解析失败: ${parseError.message}`);
        }
      } else {
        console.log(`   ❌ HTTP错误: ${response.statusCode}`);
      }

    } catch (error) {
      console.log(`   ❌ 请求失败: ${error.message}`);
    }

    console.log('');
  }

  console.log('🎯 测试完成');
  console.log('============');
  console.log('💡 如果所有测试都在期望时间内完成，说明enhancedInputValidation优化成功');
  console.log('💡 如果仍有测试超过1秒，说明还有其他性能瓶颈');
}

// 等待2秒让服务器启动
setTimeout(() => {
  runTests().catch(console.error);
}, 2000);