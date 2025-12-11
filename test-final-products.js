const request = require('supertest');

async function runFinalProductTest() {
  console.log('🎯 产品模块最终测试');
  console.log('目标：确保100%通过率！\n');

  // 生成测试token
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-do-not-use-in-production';

  const adminToken = jwt.sign(
    {
      sub: 'cmi4test000000000000000001',
      mobile: '13800138888',
      level: 'DIRECTOR',
      role: 'ADMIN',
      scope: ['active', 'user']
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log('1. 🎯 直接测试创建标签（绕过所有中间件问题）');

  try {
    const tagResponse = await request('http://localhost:3000')
      .post('/api/v1/products/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Content-Type', 'application/json')
      .send({
        name: 'final-test-tag',
        color: '#00FF00'
      });

    console.log(`状态码: ${tagResponse.status}`);
    if (tagResponse.status === 200) {
      console.log('✅ 标签创建成功！');
      console.log('响应:', JSON.stringify(tagResponse.body, null, 2));
    } else {
      console.log('❌ 标签创建失败');
      console.log('错误:', tagResponse.body);
    }
  } catch (error) {
    console.error('❌ 请求错误:', error.message);
  }

  console.log('\n2. 🎯 测试分类API响应速度');

  const startTime = Date.now();

  try {
    const catResponse = await request('http://localhost:3000')
      .get('/api/v1/products/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, perPage: 5 });

    const duration = Date.now() - startTime;
    console.log(`分类API响应时间: ${duration}ms`);
    console.log(`状态码: ${catResponse.status}`);

    if (catResponse.status === 200) {
      console.log('✅ 分类API正常！');
    }
  } catch (error) {
    console.error('❌ 分类API错误:', error.message);
  }

  console.log('\n🎯 测试结果分析:');
  console.log('如果分类API响应快，则问题在于测试框架或数据库连接');
  console.log('如果所有测试都通过，则问题已解决！');

  // 3. 提供修复建议
  console.log('\n💡 如果仍有问题，检查:');
  console.log('1. 数据库连接性能');
  console.log('2. 安全中间件配置');
  console.log('3. 测试超时设置');
  console.log('4. Prisma查询优化');
}

runFinalProductTest();