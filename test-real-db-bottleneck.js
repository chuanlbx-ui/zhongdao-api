// 测试真实数据库连接和查询 - 检查Prisma/MySQL是否有问题
require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');

console.log('🔍 测试真实数据库操作');
console.log('=====================');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testRealDatabase() {
  console.log('\n📊 测试1: 数据库连接');
  try {
    const connectStart = Date.now();
    await prisma.$connect();
    const connectTime = Date.now() - connectStart;
    console.log(`   ✅ 数据库连接成功: ${connectTime}ms`);
  } catch (error) {
    console.error(`   ❌ 数据库连接失败: ${error.message}`);
    return;
  }

  console.log('\n📊 测试2: 简单原始查询');
  try {
    const queryStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as test`;
    const queryTime = Date.now() - queryStart;
    console.log(`   ✅ 简单查询: ${queryTime}ms`);
  } catch (error) {
    console.error(`   ❌ 简单查询失败: ${error.message}`);
  }

  console.log('\n📊 测试3: Categories表COUNT查询');
  try {
    const countStart = Date.now();
    const result = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total
      FROM productCategories
      WHERE isActive = ?
    `, true);
    const countTime = Date.now() - countStart;
    console.log(`   ✅ Categories COUNT: ${countTime}ms (总数: ${result[0]?.total})`);
  } catch (error) {
    console.error(`   ❌ Categories COUNT失败: ${error.message}`);
  }

  console.log('\n📊 测试4: Categories分页查询');
  try {
    const pageStart = Date.now();
    const categories = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        name,
        level,
        parentId,
        sort,
        icon,
        description,
        createdAt,
        updatedAt
      FROM productCategories
      WHERE isActive = ?
      ORDER BY level ASC, sort ASC, createdAt ASC
      LIMIT ? OFFSET ?
    `, true, 10, 0);
    const pageTime = Date.now() - pageStart;
    console.log(`   ✅ Categories分页查询: ${pageTime}ms (返回: ${categories.length}条)`);
  } catch (error) {
    console.error(`   ❌ Categories分页查询失败: ${error.message}`);
  }

  console.log('\n📊 测试5: 并行查询（类似categories.ts）');
  try {
    const parallelStart = Date.now();
    const [totalResult, categories] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM productCategories
        WHERE isActive = ?
      `, true),
      prisma.$queryRawUnsafe(`
        SELECT
          id,
          name,
          level,
          parentId,
          sort,
          icon,
          description,
          createdAt,
          updatedAt
        FROM productCategories
        WHERE isActive = ?
        ORDER BY level ASC, sort ASC, createdAt ASC
        LIMIT ? OFFSET ?
      `, true, 10, 0)
    ]);
    const parallelTime = Date.now() - parallelStart;
    const total = Number(totalResult[0]?.total || 0);
    console.log(`   ✅ 并行查询: ${parallelTime}ms (总数: ${total}, 返回: ${categories.length}条)`);
  } catch (error) {
    console.error(`   ❌ 并行查询失败: ${error.message}`);
  }

  console.log('\n📊 测试6: Products表查询');
  try {
    const productStart = Date.now();
    const products = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total FROM products
    `);
    const productTime = Date.now() - productStart;
    console.log(`   ✅ Products COUNT: ${productTime}ms (总数: ${products[0]?.total})`);
  } catch (error) {
    console.error(`   ❌ Products COUNT失败: ${error.message}`);
  }

  console.log('\n📊 测试7: 复杂JOIN查询（模拟products.ts）');
  try {
    const joinStart = Date.now();
    const complexResult = await prisma.$queryRawUnsafe(`
      SELECT
        p.id,
        p.name,
        p.basePrice,
        pc.name as categoryName
      FROM products p
      LEFT JOIN productCategories pc ON p.categoryId = pc.id
      WHERE p.status = 'ACTIVE'
      LIMIT 5
    `);
    const joinTime = Date.now() - joinStart;
    console.log(`   ✅ 复杂JOIN查询: ${joinTime}ms (返回: ${complexResult.length}条)`);
  } catch (error) {
    console.error(`   ❌ 复杂JOIN查询失败: ${error.message}`);
  }

  console.log('\n📊 测试8: 连续10次查询（检查连接池）');
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      const time = Date.now() - start;
      times.push(time);
    } catch (error) {
      console.log(`   ❌ 查询${i+1}失败: ${error.message}`);
      times.push(9999);
    }
  }
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  console.log(`   ✅ 10次查询: 平均${avgTime.toFixed(1)}ms, 最大${maxTime}ms`);

  console.log('\n📊 测试9: Prisma ORM查询');
  try {
    const ormStart = Date.now();
    const ormResult = await prisma.productCategories.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
        sort: true,
        icon: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { level: 'asc' },
        { sort: 'asc' },
        { createdAt: 'asc' }
      ],
      take: 10,
      skip: 0
    });
    const ormTime = Date.now() - ormStart;
    console.log(`   ✅ Prisma ORM查询: ${ormTime}ms (返回: ${ormResult.length}条)`);
  } catch (error) {
    console.error(`   ❌ Prisma ORM查询失败: ${error.message}`);
  }

  console.log('\n📊 测试10: 模拟完整API查询流程');
  try {
    const apiStart = Date.now();

    // 步骤1: 验证JWT (模拟)
    const jwtStart = Date.now();
    // 这里我们模拟JWT验证耗时
    await new Promise(resolve => setTimeout(resolve, 1));
    const jwtTime = Date.now() - jwtStart;

    // 步骤2: 数据库查询
    const dbStart = Date.now();
    const [total, categories] = await Promise.all([
      prisma.productCategories.count({ where: { isActive: true } }),
      prisma.productCategories.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          level: true,
          parentId: true,
          sort: true,
          icon: true,
          description: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [
          { level: 'asc' },
          { sort: 'asc' },
          { createdAt: 'asc' }
        ],
        skip: 0,
        take: 10
      })
    ]);
    const dbTime = Date.now() - dbStart;

    // 步骤3: 数据处理
    const processStart = Date.now();
    const result = {
      success: true,
      data: {
        categories: categories.map(cat => ({
          ...cat,
          createdAt: cat.createdAt.toISOString(),
          updatedAt: cat.updatedAt.toISOString()
        })),
        pagination: {
          page: 1,
          perPage: 10,
          total,
          totalPages: Math.ceil(total / 10)
        }
      }
    };
    const processTime = Date.now() - processStart;

    const totalTime = Date.now() - apiStart;
    console.log(`   ✅ 完整API流程: ${totalTime}ms`);
    console.log(`      - JWT验证: ${jwtTime}ms`);
    console.log(`      - 数据库查询: ${dbTime}ms`);
    console.log(`      - 数据处理: ${processTime}ms`);

    if (totalTime > 5000) {
      console.log(`   🚨 警告：完整API流程耗时 ${totalTime}ms，超过正常范围！`);
    }

  } catch (error) {
    console.error(`   ❌ 完整API流程失败: ${error.message}`);
  }

  // 清理连接
  console.log('\n📊 清理数据库连接');
  try {
    const disconnectStart = Date.now();
    await prisma.$disconnect();
    const disconnectTime = Date.now() - disconnectStart;
    console.log(`   ✅ 数据库断开: ${disconnectTime}ms`);
  } catch (error) {
    console.error(`   ❌ 数据库断开失败: ${error.message}`);
  }

  console.log('\n🎯 数据库性能测试完成');
  console.log('========================');
  console.log('💡 如果所有查询都很快（<100ms），说明数据库不是瓶颈');
  console.log('💡 如果有查询很慢，说明数据库层面有问题');
}

// 启动测试
testRealDatabase()
  .then(() => {
    console.log('\n✅ 数据库测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 数据库测试失败:', error);
    process.exit(1);
  });