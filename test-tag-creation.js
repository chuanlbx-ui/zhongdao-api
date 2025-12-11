const request = require('supertest');
const jwt = require('jsonwebtoken');

async function testTagCreation() {
  console.log('🎯 测试标签创建 - 验证安全中间件修复');

  // 使用测试助手的JWT_SECRET
  const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

  const adminToken = jwt.sign(
    {
      sub: 'cmi4test000000000000000001',
      phone: '13800138888',
      role: 'ADMIN',
      level: 'DIRECTOR',
      scope: ['active', 'user'],
      type: 'access'
    },
    JWT_SECRET,
    {
      expiresIn: '24h',
      issuer: 'zhongdao-mall-test',
      audience: 'zhongdao-mall-users'
    }
  );

  console.log('\n1️⃣ 测试创建带颜色值的标签（之前会被安全中间件阻止）');

  try {
    const response = await request('http://localhost:3000')
      .post('/api/v1/products/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'test-color-tag',
        color: '#00FF00',  // 这个#字符之前会被误判为危险内容
        description: '测试颜色值不会被误判'
      });

    console.log(`状态码: ${response.status}`);
    if (response.status === 200) {
      console.log('✅ 安全中间件修复成功！标签创建通过');
      console.log('响应:', JSON.stringify(response.body, null, 2));
    } else if (response.status === 400) {
      console.log('❌ 安全中间件仍然阻止请求');
      console.log('错误:', response.body);
    } else if (response.status === 401) {
      console.log('⚠️ 认证问题，但安全检查通过了');
      console.log('错误:', response.body);
    } else {
      console.log('⚠️ 其他错误:', response.body);
    }
  } catch (error) {
    console.error('❌ 请求错误:', error.message);
  }

  console.log('\n2️⃣ 测试真正的危险内容是否仍被阻止');

  try {
    const dangerousResponse = await request('http://localhost:3000')
      .post('/api/v1/products/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'dangerous-tag',
        description: 'SELECT * FROM users; DROP TABLE users;--'
      });

    console.log(`危险内容状态码: ${dangerousResponse.status}`);
    if (dangerousResponse.status === 400) {
      console.log('✅ 真正的危险内容仍被正确阻止');
    } else {
      console.log('❌ 危险内容未被阻止，安全问题！');
    }
  } catch (error) {
    console.error('❌ 危险内容测试错误:', error.message);
  }
}

testTagCreation().then(() => {
  console.log('\n🎉 测试完成！');
}).catch(error => {
  console.error('测试失败:', error);
});