const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugCategoriesPerformance() {
  console.log('🔍 调试分类API性能差异...\n');

  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 测试1: categories tree API (快速)
    console.log('\n📊 测试1: categories tree (130ms成功案例)');
    const treeStart = Date.now();
    const categories = await prisma.productCategories.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
        sort: true,
        icon: true,
        description: true,
        createdAt: true
      },
      orderBy: [
        { level: 'asc' },
        { sort: 'asc' },
        { createdAt: 'asc' }
      ]
    });
    const treeTime = Date.now() - treeStart;
    console.log(`   Tree查询耗时: ${treeTime}ms, 返回${categories.length}条记录`);

    // 测试2: categories list API - 简化版 (排除复杂逻辑)
    console.log('\n📋 测试2: categories list简化版');
    const listStart = Date.now();

    // 模拟API查询参数
    const pageNum = 1;
    const perPageNum = 10;
    const skip = (pageNum - 1) * perPageNum;

    // 最简单的WHERE条件
    const whereClause = 'isActive = true';
    const params = [];

    // 执行COUNT查询
    const countStart = Date.now();
    const totalResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total
      FROM productCategories
      WHERE ${whereClause}
    `, ...params);
    const countTime = Date.now() - countStart;
    console.log(`   COUNT查询耗时: ${countTime}ms`);

    // 执行分页查询
    const selectStart = Date.now();
    const categoriesResult = await prisma.$queryRawUnsafe(`
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
      WHERE ${whereClause}
      ORDER BY level ASC, sort ASC, createdAt ASC
      LIMIT ? OFFSET ?
    `, ...params, perPageNum, skip);
    const selectTime = Date.now() - selectStart;
    console.log(`   SELECT查询耗时: ${selectTime}ms`);

    const listTime = Date.now() - listStart;
    const total = totalResult[0]?.total || 0;
    console.log(`   List总耗时: ${listTime}ms, 总数: ${total}, 返回${categoriesResult.length}条记录`);

    // 测试3: 检查是否有性能监控阻塞
    console.log('\n⚡ 测试3: 检查性能监控');
    const monitorStart = Date.now();

    // 模拟可能的阻塞操作
    await new Promise(resolve => setTimeout(resolve, 100));

    const monitorTime = Date.now() - monitorStart;
    console.log(`   模拟阻塞耗时: ${monitorTime}ms`);

    // 测试4: 直接Prisma查询 vs 原生SQL
    console.log('\n🔧 测试4: Prisma vs 原生SQL对比');

    const prismaStart = Date.now();
    const prismaResult = await prisma.productCategories.findMany({
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
      skip,
      take: perPageNum
    });
    const prismaTime = Date.now() - prismaStart;
    console.log(`   Prisma查询耗时: ${prismaTime}ms, 返回${prismaResult.length}条记录`);

    console.log('\n✅ 性能调试完成');
    console.log('\n📈 性能对比总结:');
    console.log(`   Tree API:     ${treeTime}ms`);
    console.log(`   List API:     ${listTime}ms (COUNT: ${countTime}ms + SELECT: ${selectTime}ms)`);
    console.log(`   Prisma API:   ${prismaTime}ms`);

    if (listTime > 1000) {
      console.log('\n🚨 List API性能异常，可能原因:');
      console.log('   1. 中间件阻塞');
      console.log('   2. 数据库连接池问题');
      console.log('   3. 性能监控干扰');
      console.log('   4. 并发查询锁竞争');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCategoriesPerformance();