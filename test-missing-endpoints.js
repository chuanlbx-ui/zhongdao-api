const request = require('supertest');
const app = require('./src/index');

async function testEndpoints() {
  console.log('测试用户系统API端点...\n');

  try {
    // 测试用户状态端点
    console.log('1. 测试 /api/v1/users/me');
    try {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer mock_token');

      console.log('状态码:', response.status);
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.log('错误:', error.message);
    }

    console.log('\n-----------------------------------\n');

    // 测试认证状态端点
    console.log('2. 测试 /api/v1/auth/me');
    try {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer mock_token');

      console.log('状态码:', response.status);
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.log('错误:', error.message);
    }

    console.log('\n-----------------------------------\n');

    // 测试管理员配置端点
    console.log('3. 测试 /api/v1/admin/configs');
    try {
      const response = await request(app)
        .get('/api/v1/admin/configs');

      console.log('状态码:', response.status);
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } catch (error) {
      console.log('错误:', error.message);
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testEndpoints();