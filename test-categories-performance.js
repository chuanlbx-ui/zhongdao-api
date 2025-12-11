const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCategoriesPerformance() {
  console.log('🔍 测试商品分类查询性能...\n');

  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 测试1: 简单COUNT查询
    console.log('\n📊 测试1: COUNT查询');
    const countStart = Date.now();
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM productCategories
      WHERE isActive = true
    `;
    const countTime = Date.now() - countStart;
    console.log(`   COUNT查询耗时: ${countTime}ms, 总数: ${countResult[0]?.total}`);

    // 测试2: 简单分页查询
    console.log('\n📋 测试2: 分页查询 (前10条)');
    const selectStart = Date.now();
    const categories = await prisma.$queryRaw`
      SELECT
        id, name, level, parentId, sort, icon, description, createdAt, updatedAt
      FROM productCategories
      WHERE isActive = true
      ORDER BY level ASC, sort ASC, createdAt ASC
      LIMIT 10 OFFSET 0
    `;
    const selectTime = Date.now() - selectStart;
    console.log(`   分页查询耗时: ${selectTime}ms, 返回${categories.length}条记录`);

    // 测试3: 并行查询（当前代码使用的）
    console.log('\n🚀 测试3: 并行COUNT+SELECT查询');
    const parallelStart = Date.now();
    const [totalResult2, categories2] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as total FROM productCategories WHERE isActive = true`,
      prisma.$queryRaw`
        SELECT
          id, name, level, parentId, sort, icon, description, createdAt, updatedAt
        FROM productCategories
        WHERE isActive = true
        ORDER BY level ASC, sort ASC, createdAt ASC
        LIMIT 10 OFFSET 0
      `
    ]);
    const parallelTime = Date.now() - parallelStart;
    console.log(`   并行查询耗时: ${parallelTime}ms`);

    // 测试4: 使用Prisma标准查询
    console.log('\n🔧 测试4: Prisma标准查询');
    const prismaStart = Date.now();
    const prismaCategories = await prisma.productCategories.findMany({
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
    const prismaTime = Date.now() - prismaStart;
    console.log(`   Prisma查询耗时: ${prismaTime}ms, 返回${prismaCategories.length}条记录`);

    // 测试5: 检查表中的总数据量
    console.log('\n📈 测试5: 数据统计');
    const [totalCount, activeCount] = await Promise.all([
      prisma.productCategories.count(),
      prisma.productCategories.count({ where: { isActive: true } })
    ]);
    console.log(`   总分类数: ${totalCount}`);
    console.log(`   活跃分类数: ${activeCount}`);

    console.log('\n✅ 性能测试完成');

    // 找出最慢的查询
    const results = [
      { name: 'COUNT查询', time: countTime },
      { name: '分页查询', time: selectTime },
      { name: '并行查询', time: parallelTime },
      { name: 'Prisma查询', time: prismaTime }
    ];

    const slowest = results.reduce((prev, curr) => (curr.time > prev.time ? curr : prev));
    console.log(`\n⚠️  最慢的查询: ${slowest.name} (${slowest.time}ms)`);

    if (slowest.time > 1000) {
      console.log('🚨 建议优化: 查询时间超过1秒，需要优化');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCategoriesPerformance();
