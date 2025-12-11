const dotenv = require('dotenv');
const request = require('supertest');

// 🚀 强制使用最极简的测试配置
dotenv.config({ path: '.env.test-minimal' });

// 强制设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev';
process.env.DB_POOL_MIN = '1';
process.env.DB_POOL_MAX = '5';
process.env.DISABLE_SECURITY_MIDDLEWARE = 'true';
process.env.DISABLE_CSRF = 'true';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.DISABLE_INPUT_VALIDATION = 'true';
process.env.DISABLE_PERFORMANCE_MONITOR = 'true';
process.env.SKIP_DB_SEED = 'true';
process.env.SKIP_CONFIG_INIT = 'true';

console.log('🔧 极简测试环境配置:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('DB_POOL_MAX:', process.env.DB_POOL_MAX);

async function quickTest() {
  try {
    console.log('\n🚀 启动极简测试...');

    // 延迟2秒等待服务器完全启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    const startTime = Date.now();

    // 测试健康检查
    console.log('\n1️⃣ 测试健康检查...');
    const healthResponse = await request('http://localhost:3001')
      .get('/health')
      .timeout(5000);

    console.log(`✅ 健康检查: ${healthResponse.status} (${Date.now() - startTime}ms)`);

    // 测试分类树API
    console.log('\n2️⃣ 测试分类树API...');
    const treeResponse = await request('http://localhost:3001')
      .get('/api/v1/products/categories/tree')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWtoMnh1bTlyYnAiLCJwaG9uZSI6IjEzODAwMTM4MDAxIiwicm9sZSI6Ik5PUk1BTCIsImxldmVsIjoiTk9STUFMIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzY1MTE0NjUwLCJleHAiOjE3NjUyMDEwNTAsImF1ZCI6Inpob25nZGFvLW1hbGwtdXNlcnMiLCJpc3MiOiJ6aG9uZ2Rhby1tYWxsLXRlc3QifQ.ZlCJCYXj0NGBj9oEREYNepOw4puxvnrfulAFMex5_VQ')
      .timeout(10000);

    console.log(`✅ 分类树: ${treeResponse.status} (${Date.now() - startTime}ms)`);

    // 测试分类列表API
    console.log('\n3️⃣ 测试分类列表API...');
    const listResponse = await request('http://localhost:3001')
      .get('/api/v1/products/categories?page=1&perPage=10')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWtoMnh1bTlyYnAiLCJwaG9uZSI6IjEzODAwMTM4MDAxIiwicm9sZSI6Ik5PUk1BTCIsImxldmVsIjoiTk9STUFMIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzY1MTE0NjUwLCJleHAiOjE3NjUyMDEwNTAsImF1ZCI6Inpob25nZGFvLW1hbGwtdXNlcnMiLCJpc3MiOiJ6aG9uZ2Rhby1tYWxsLXRlc3QifQ.ZlCJCYXj0NGBj9oEREYNepOw4puxvnrfulAFMex5_VQ')
      .timeout(10000);

    console.log(`✅ 分类列表: ${listResponse.status} (${Date.now() - startTime}ms)`);

    console.log('\n🎉 所有测试完成！');
    console.log(`总耗时: ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.timeout) {
      console.error('⏰ 请求超时:', error.timeout);
    }
    process.exit(1);
  }
}

quickTest();