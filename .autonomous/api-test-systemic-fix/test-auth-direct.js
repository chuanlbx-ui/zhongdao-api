const request = require('supertest');
const app = require('../../dist/index.js').default;

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

console.log('🔍 直接测试API认证\n');

// 生成测试token
function generateTestToken(userRole, userLevel) {
  return jwt.sign({
    sub: 'test-user-123',
    phone: '18800000002',
    role: userRole,
    level: userLevel,
    scope: ['active', 'user'],
    type: 'access'
  }, JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'zhongdao-mall-test',
    audience: 'zhongdao-mall-users'
  });
}

async function testAuth() {
  // 1. 测试无认证的请求
  console.log('1. 测试无认证访问:');
  try {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .expect(401);
    console.log('   ✅ 无认证请求正确返回401');
  } catch (error) {
    console.log('   ❌ 无认证请求失败:', error.message);
  }

  // 2. 测试有效token
  console.log('\n2. 测试有效token:');
  try {
    const token = generateTestToken('USER', 'NORMAL');
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    console.log('   ✅ 有效token访问成功');
    console.log('   响应数据:', JSON.stringify(response.body, null, 2).substring(0, 200) + '...');
  } catch (error) {
    console.log('   ❌ 有效token访问失败:', error.message);
    if (error.response) {
      console.log('   错误响应:', error.response.text.substring(0, 200));
    }
  }

  // 3. 测试无效token
  console.log('\n3. 测试无效token:');
  try {
    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', 'Bearer invalid.token.here')
      .expect(401);
    console.log('   ✅ 无效token正确被拒绝');
  } catch (error) {
    console.log('   ❌ 无效token测试失败:', error.message);
  }

  // 4. 测试测试环境的token
  console.log('\n4. 测试测试环境token:');
  try {
    // 使用TestAuthHelper生成token
    const { TestAuthHelper } = require('../../tests/helpers/auth.helper.ts');
    const testUser = await TestAuthHelper.createTestUserByType('normal');

    const response = await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${testUser.tokens.accessToken}`)
      .expect(200);
    console.log('   ✅ 测试环境token访问成功');
  } catch (error) {
    console.log('   ❌ 测试环境token失败:', error.message);
    console.log('   提示: 可能是因为TypeScript文件需要编译');
  }

  // 5. 检查中间件是否正确加载
  console.log('\n5. 检查中间件:');
  try {
    const response = await request(app)
      .get('/health')
      .expect(200);
    console.log('   ✅ 健康检查端点正常');
  } catch (error) {
    console.log('   ❌ 健康检查失败:', error.message);
  }
}

// 运行测试
testAuth().then(() => {
  console.log('\n✅ 认证测试完成');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});