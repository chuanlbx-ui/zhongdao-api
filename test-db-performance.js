const { prisma } = require('./src/shared/database/client');

async function testDatabasePerformance() {
  console.log('🔍 测试数据库查询性能...\n');

  try {
    // 测试1: COUNT查询性能
    console.log('📊 测试COUNT查询...');
    const countStart = Date.now();
    const totalResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM productCategories WHERE isActive = ?`,
      true
    ) as any[];
    const countTime = Date.now() - countStart;
    console.log(`   COUNT查询耗时: ${countTime}ms, 总数: ${totalResult[0]?.total || 0}`);

    // 测试2: 简单SELECT查询性能
    console.log('\n📋 测试简单SELECT查询...');
    const selectStart = Date.now();
    const categories = await prisma.$queryRawUnsafe(`
      SELECT id, name, level, parentId, sort, icon, description, createdAt, updatedAt
      FROM productCategories
      WHERE isActive = ?
      ORDER BY level ASC, sort ASC, createdAt ASC
      LIMIT 10 OFFSET 0
    `, true) as any[];
    const selectTime = Date.now() - selectStart;
    console.log(`   SELECT查询耗时: ${selectTime}ms, 返回${categories.length}条数据`);

    // 测试3: 使用Prisma ORM查询性能
    console.log('\n🔧 测试Prisma ORM查询...');
    const ormStart = Date.now();
    const ormCategories = await prisma.productCategories.findMany({
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
    console.log(`   Prisma ORM查询耗时: ${ormTime}ms, 返回${ormCategories.length}条数据`);

    // 测试4: 检查表的总行数
    console.log('\n📈 检查表的总行数...');
    const tableStats = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) as total_rows,
        COUNT(CASE WHEN isActive = 1 THEN 1 END) as active_rows
      FROM productCategories
    `) as any[];
    console.log(`   总行数: ${tableStats[0]?.total_rows}, 活跃行数: ${tableStats[0]?.active_rows}`);

    console.log('\n✅ 数据库性能测试完成');

  } catch (error) {
    console.error('❌ 数据库测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabasePerformance().catch(console.error);