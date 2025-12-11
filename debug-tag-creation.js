const request = require('supertest');
const jwt = require('jsonwebtoken');

async function debugTagCreation() {
  console.log('🔍 调试商品标签创建权限问题\n');

  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-do-not-use-in-production';

  // 创建一个具有DIRECTOR权限的token
  const adminToken = jwt.sign(
    {
      userId: 'test_director_user',
      mobile: '13800138002',
      level: 'DIRECTOR',
      role: 'ADMIN',
      sub: 'test_director_user',
      phone: '13800138002',
      scope: ['active', 'user'],
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('1. 创建的Token内容:', JSON.parse(Buffer.from(adminToken.split('.')[1], 'base64').toString()));
  console.log('2. Token签名验证:', jwt.verify(adminToken, JWT_SECRET) ? '✅ 有效' : '❌ 无效');

  const tagData = {
    name: `调试标签_${Date.now()}`,
    color: '#FF0000',
    description: '这是一个调试测试标签'
  };

  console.log('\n3. 测试创建标签...');
  console.log('请求数据:', JSON.stringify(tagData, null, 2));
  console.log('Authorization头:', `Bearer ${adminToken.substring(0, 20)}...`);

  try {
    const response = await request('http://localhost:3000')
      .post('/api/v1/products/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send(tagData);

    console.log('\n4. 响应结果:');
    console.log(`状态码: ${response.status}`);
    console.log('响应体:', JSON.stringify(response.body, null, 2));

    if (response.status === 400) {
      console.log('\n🔍 400错误分析:');
      console.log('- 可能原因1: 输入验证失败');
      console.log('- 可能原因2: 数据库约束违反');
      console.log('- 可能原因3: 中间件问题');

      // 检查是否有验证错误
      if (response.body.errors && response.body.errors.length > 0) {
        console.log('\n验证错误详情:');
        response.body.errors.forEach(error => {
          console.log(`- ${error.field}: ${error.message}`);
        });
      }
    }

  } catch (error) {
    console.error('请求失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应体:', error.response.data);
    }
  }
}

debugTagCreation();