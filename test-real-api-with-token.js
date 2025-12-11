const request = require('supertest');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.development' });

// 确保环境变量已加载
console.log('JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'undefined');

// 生成有效的token
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET 未设置！');
  process.exit(1);
}

// 生成管理员token
const adminToken = jwt.sign({
  sub: 'test-admin-id-12345',
  role: 'ADMIN',
  level: 'DIRECTOR',
  scope: ['active', 'admin', 'read', 'write']
}, JWT_SECRET, {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-users'
});

// 生成普通用户token
const userToken = jwt.sign({
  sub: 'test-user-id-12345',
  role: 'USER',
  level: 'NORMAL',
  scope: ['active']
}, JWT_SECRET, {
  expiresIn: '7d',
  algorithm: 'HS256',
  issuer: 'zhongdao-mall',
  audience: 'zhongdao-users'
});

console.log('\n=== 生成的测试Token ===');
console.log('管理员Token:', adminToken);
console.log('用户Token:', userToken);

// 导入应用
const app = require('./src/index');

// 测试API端点
async function testAPIEndpoints() {
  console.log('\n=== 测试1: 健康检查端点 ===');
  try {
    const healthResponse = await request(app)
      .get('/health')
      .expect(200);
    console.log('✓ 健康检查通过');
    console.log('响应:', healthResponse.body);
  } catch (error) {
    console.error('❌ 健康检查失败:', error.message);
  }

  console.log('\n=== 测试2: 获取当前用户信息 (管理员) ===');
  try {
    const authResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .timeout(10000);

    if (authResponse.status === 200) {
      console.log('✓ 管理员认证成功');
      console.log('用户信息:', JSON.stringify(authResponse.body, null, 2));
    } else {
      console.log('❌ 管理员认证失败，状态码:', authResponse.status);
      console.log('响应:', authResponse.body);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    if (error.response) {
      console.log('错误响应:', error.response.body);
    }
  }

  console.log('\n=== 测试3: 获取当前用户信息 (普通用户) ===');
  try {
    const userResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userToken}`)
      .timeout(10000);

    if (userResponse.status === 200) {
      console.log('✓ 用户认证成功');
      console.log('用户信息:', JSON.stringify(userResponse.body, null, 2));
    } else {
      console.log('❌ 用户认证失败，状态码:', userResponse.status);
      console.log('响应:', userResponse.body);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    if (error.response) {
      console.log('错误响应:', error.response.body);
    }
  }

  console.log('\n=== 测试4: 访问管理端点 (管理员) ===');
  try {
    const adminResponse = await request(app)
      .get('/api/v1/admin/configs')
      .set('Authorization', `Bearer ${adminToken}`)
      .timeout(10000);

    if (adminResponse.status === 200) {
      console.log('✓ 管理端点访问成功');
    } else {
      console.log('❌ 管理端点访问失败，状态码:', adminResponse.status);
      console.log('响应:', adminResponse.body);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    if (error.response) {
      console.log('错误响应:', error.response.body);
    }
  }
}

// 启动测试
setTimeout(() => {
  testAPIEndpoints()
    .then(() => {
      console.log('\n=== 测试完成 ===');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 测试过程中发生错误:', error);
      process.exit(1);
    });
}, 2000); // 等待应用启动