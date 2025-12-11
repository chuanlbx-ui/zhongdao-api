const { prisma } = require('./src/shared/database/client');

async function testSequentialVsParallel() {
  console.log('🔍 测试顺序查询 vs 并行查询性能差异...\n');

  const whereClause = 'isActive = ?';
  const params = [true];
  const skip = 0;
  const perPageNum = 10;

  try {
    // 测试1: 顺序执行（当前方式）
    console.log('📊 测试1: 顺序执行COUNT + SELECT');
    const sequentialStart = Date.now();

    const totalResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total
      FROM productCategories
      WHERE ${whereClause}
    `, ...params);

    const total = totalResult[0]?.total || 0;

    let categories = [];
    if (total > 0 && skip < total) {
      categories = await prisma.$queryRawUnsafe(`
        SELECT
          id, name, level, parentId, sort, icon, description, createdAt, updatedAt
        FROM productCategories
        WHERE ${whereClause}
        ORDER BY level ASC, sort ASC, createdAt ASC
        LIMIT ? OFFSET ?
      `, ...params, Math.min(perPageNum, total - skip), skip);
    }

    const sequentialTime = Date.now() - sequentialStart;
    console.log(`   顺序执行耗时: ${sequentialTime}ms, 返回${categories.length}条数据`);

    // 等待一下避免连续查询影响
    await new Promise(resolve => setTimeout(resolve, 100));

    // 测试2: 并行执行（优化方式）
    console.log('\n🚀 测试2: 并行执行COUNT + SELECT');
    const parallelStart = Date.now();

    const [totalResultParallel, categoriesParallel] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM productCategories
        WHERE ${whereClause}
      `, ...params),

      prisma.$queryRawUnsafe(`
        SELECT
          id, name, level, parentId, sort, icon, description, createdAt, updatedAt
        FROM productCategories
        WHERE ${whereClause}
        ORDER BY level ASC, sort ASC, createdAt ASC
        LIMIT ? OFFSET ?
      `, ...params, perPageNum, skip)
    ]);

    const parallelTime = Date.now() - parallelStart;
    console.log(`   并行执行耗时: ${parallelTime}ms, 返回${categoriesParallel.length}条数据`);

    // 性能对比
    const improvement = sequentialTime - parallelTime;
    const improvementPercent = ((improvement / sequentialTime) * 100).toFixed(1);

    console.log('\n📈 性能对比结果:');
    console.log(`   顺序执行: ${sequentialTime}ms`);
    console.log(`   并行执行: ${parallelTime}ms`);
    console.log(`   性能提升: ${improvement}ms (${improvementPercent}%)`);

    if (parallelTime < sequentialTime) {
      console.log('   ✅ 并行执行更快！');
    } else {
      console.log('   ⚠️  顺序执行更快（可能数据库连接池限制）');
    }

    console.log('\n✅ 性能对比测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSequentialVsParallel().catch(console.error);