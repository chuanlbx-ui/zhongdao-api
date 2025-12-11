const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
    }
  }
});

const app = require('./src/index');

// 测试配置
const API_BASE = '/api/v1';
let testTokens = {
  normalUser: null,
  adminUser: null
};

async function setupTestUsers() {
  console.log('🔧 设置测试用户...');

  // 创建或获取普通用户
  let normalUser = await prisma.user.findFirst({
    where: { level: 'NORMAL' }
  });

  if (!normalUser) {
    normalUser = await prisma.user.create({
      data: {
        id: `cmi${Date.now()}`,
        mobile: '13800138001',
        username: 'test_normal_user',
        nickname: '测试普通用户',
        level: 'NORMAL',
        status: 'ACTIVE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  // 创建或获取管理员用户
  let adminUser = await prisma.user.findFirst({
    where: { level: 'DIRECTOR' }
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        id: `cmi${Date.now() + 1}`,
        mobile: '13800138002',
        username: 'test_director_user',
        nickname: '测试管理员',
        level: 'DIRECTOR',
        status: 'ACTIVE',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  }

  // 生成测试token（简化版本）
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-do-not-use-in-production';

  testTokens.normalUser = jwt.sign(
    {
      userId: normalUser.id,
      mobile: normalUser.mobile,
      level: normalUser.level,
      role: 'USER'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  testTokens.adminUser = jwt.sign(
    {
      userId: adminUser.id,
      mobile: adminUser.mobile,
      level: adminUser.level,
      role: 'ADMIN'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log(`✅ 测试用户设置完成 - 普通用户: ${normalUser.username}, 管理员: ${adminUser.username}`);
}

async function runQuickTests() {
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  const tests = [
    {
      name: '获取商品分类树',
      method: 'GET',
      url: `${API_BASE}/products/categories/tree`,
      token: testTokens.normalUser,
      expectedStatus: 200
    },
    {
      name: '获取商品标签列表',
      method: 'GET',
      url: `${API_BASE}/products/tags/all`,
      token: testTokens.normalUser,
      expectedStatus: 200
    },
    {
      name: '获取商品分类列表',
      method: 'GET',
      url: `${API_BASE}/products/categories?level=1&page=1&perPage=10`,
      token: testTokens.normalUser,
      expectedStatus: 200
    },
    {
      name: '获取商品标签分页列表',
      method: 'GET',
      url: `${API_BASE}/products/tags?page=1&perPage=10`,
      token: testTokens.normalUser,
      expectedStatus: 200
    }
  ];

  console.log('\n🧪 开始快速API测试...\n');

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`[${i + 1}/${tests.length}] 测试: ${test.name}`);

    try {
      const req = request(app)[test.method.toLowerCase()](test.url);

      if (test.token) {
        req.set('Authorization', `Bearer ${test.token}`);
      }

      const response = await req;

      if (response.status === test.expectedStatus) {
        console.log(`  ✅ 通过 - ${response.status}`);
        results.passed++;
      } else {
        console.log(`  ❌ 失败 - 期望 ${test.expectedStatus}, 实际 ${response.status}`);
        console.log(`     响应: ${JSON.stringify(response.body, null, 2)}`);
        results.failed++;
        results.errors.push(`${test.name}: 状态码不匹配 (${response.status} vs ${test.expectedStatus})`);
      }
    } catch (error) {
      console.log(`  ❌ 错误 - ${error.message}`);
      results.failed++;
      results.errors.push(`${test.name}: ${error.message}`);
    }

    // 添加小延迟避免过快请求
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

async function main() {
  try {
    console.log('🚀 产品模块API快速验证工具\n');

    await setupTestUsers();
    const results = await runQuickTests();

    console.log('\n📊 测试结果:');
    console.log(`✅ 通过: ${results.passed}`);
    console.log(`❌ 失败: ${results.failed}`);
    console.log(`📈 成功率: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.errors.length > 0) {
      console.log('\n🔍 失败详情:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (results.failed === 0) {
      console.log('\n🎉 所有核心API测试通过！产品模块修复成功！');
    } else {
      console.log('\n⚠️  仍有API需要修复');
    }

  } catch (error) {
    console.error('❌ 测试运行失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();