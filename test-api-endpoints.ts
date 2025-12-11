import request from 'supertest';
import app from './src/index';
import { generateToken } from './src/shared/middleware/auth';

async function testEndpoints() {
  console.log('测试用户系统API端点...\n');

  // 生成测试token
  const testToken = generateToken({
    sub: 'test-user-id',
    scope: ['active', 'user'],
    role: 'USER',
    level: 'normal'
  });

  const adminToken = generateToken({
    sub: 'admin-user-id',
    scope: ['active', 'admin'],
    role: 'ADMIN',
    level: 'director'
  });

  try {
    // 测试用户状态端点
    console.log('1. 测试 /api/v1/users/me');
    try {
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${testToken}`);

      console.log('状态码:', response.status);
      if (response.status === 404) {
        console.log('用户不存在（这是正常的，因为我们使用的是测试ID）');
      }
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } catch (error: any) {
      console.log('错误:', error.message);
    }

    console.log('\n-----------------------------------\n');

    // 测试认证状态端点
    console.log('2. 测试 /api/v1/auth/me');
    try {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testToken}`);

      console.log('状态码:', response.status);
      if (response.status === 404) {
        console.log('用户不存在（这是正常的，因为我们使用的是测试ID）');
      }
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } catch (error: any) {
      console.log('错误:', error.message);
    }

    console.log('\n-----------------------------------\n');

    // 测试管理员配置端点
    console.log('3. 测试 /api/v1/admin/configs');
    try {
      const response = await request(app)
        .get('/api/v1/admin/configs')
        .set('Authorization', `Bearer ${adminToken}`);

      console.log('状态码:', response.status);
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } catch (error: any) {
      console.log('错误:', error.message);
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testEndpoints().then(() => {
  console.log('\n测试完成');
  process.exit(0);
}).catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});