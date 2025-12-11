// 深度分析categories查询性能瓶颈
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function analyzeCategoriesBottleneck() {
  console.log('🔍 深度分析categories查询性能瓶颈...\n');

  try {
    // 1. 测试基本连接
    console.log('1. 测试数据库连接...');
    const connectStart = Date.now();
    await prisma.$connect();
    console.log(`   数据库连接耗时: ${Date.now() - connectStart}ms\n`);

    // 2. 测试简单的COUNT查询
    console.log('2. 测试简单COUNT查询...');
    const countStart = Date.now();
    const simpleCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM productCategories`;
    console.log(`   简单COUNT查询耗时: ${Date.now() - countStart}ms, 结果: ${simpleCount[0].count}\n`);

    // 3. 测试带WHERE的COUNT查询
    console.log('3. 测试带WHERE的COUNT查询...');
    const whereCountStart = Date.now();
    const whereCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM productCategories WHERE isActive = true
    `;
    console.log(`   WHERE COUNT查询耗时: ${Date.now() - whereCountStart}ms, 结果: ${whereCount[0].count}\n`);

    // 4. 测试简单的SELECT查询
    console.log('4. 测试简单SELECT查询...');
    const selectStart = Date.now();
    const simpleSelect = await prisma.$queryRaw`
      SELECT id, name, level FROM productCategories WHERE isActive = true LIMIT 5
    `;
    console.log(`   简单SELECT查询耗时: ${Date.now() - selectStart}ms, 返回${simpleSelect.length}条\n`);

    // 5. 测试完整的SELECT查询（模拟API）
    console.log('5. 测试完整SELECT查询（模拟API）...');
    const fullSelectStart = Date.now();
    const fullSelect = await prisma.$queryRaw`
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
      WHERE isActive = true
      ORDER BY level ASC, sort ASC, createdAt ASC
      LIMIT 10 OFFSET 0
    `;
    console.log(`   完整SELECT查询耗时: ${Date.now() - fullSelectStart}ms, 返回${fullSelect.length}条\n`);

    // 6. 测试顺序执行（当前API方式）
    console.log('6. 测试顺序执行COUNT+SELECT（当前API方式）...');
    const sequentialStart = Date.now();

    const countResult = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as total
      FROM productCategories
      WHERE isActive = ?
    `, true);

    const total = countResult[0]?.total || 0;

    let categories = [];
    if (total > 0) {
      categories = await prisma.$queryRawUnsafe(`
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
    }

    const sequentialTime = Date.now() - sequentialStart;
    console.log(`   顺序执行耗时: ${sequentialTime}ms, COUNT: ${total}, SELECT: ${categories.length}条\n`);

    // 7. 测试并行执行（优化方式）
    console.log('7. 测试并行执行COUNT+SELECT（优化方式）...');
    const parallelStart = Date.now();

    const [parallelCountResult, parallelCategories] = await Promise.all([
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
    const parallelTotal = parallelCountResult[0]?.total || 0;
    console.log(`   并行执行耗时: ${parallelTime}ms, COUNT: ${parallelTotal}, SELECT: ${parallelCategories.length}条\n`);

    // 8. 性能对比
    console.log('8. 性能对比分析:');
    console.log(`   顺序执行: ${sequentialTime}ms`);
    console.log(`   并行执行: ${parallelTime}ms`);

    if (parallelTime < sequentialTime) {
      const improvement = sequentialTime - parallelTime;
      const improvementPercent = ((improvement / sequentialTime) * 100).toFixed(1);
      console.log(`   性能提升: ${improvement}ms (${improvementPercent}%) ✅`);
    } else {
      console.log(`   性能下降: ${parallelTime - sequentialTime}ms ⚠️`);
    }

    // 9. 检查是否存在锁等待
    console.log('\n9. 检查数据库锁状态...');
    const locks = await prisma.$queryRaw`SHOW PROCESSLIST`;
    const activeQueries = locks.filter(lock => lock.State && lock.State !== '');
    if (activeQueries.length > 0) {
      console.log(`   发现${activeQueries.length}个活跃查询:`);
      activeQueries.forEach(q => {
        console.log(`     - ID:${q.Id} State:${q.State} Time:${q.Time}s Info:${q.Info?.substring(0, 50)}...`);
      });
    } else {
      console.log('   没有发现活跃查询阻塞');
    }

    // 10. 检查表结构
    console.log('\n10. 检查productCategories表结构...');
    const tableStructure = await prisma.$queryRaw`DESCRIBE productCategories`;
    console.log('   字段信息:');
    tableStructure.forEach(field => {
      console.log(`     - ${field.Field}: ${field.Type} ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${field.Key ? `(${field.Key})` : ''}`);
    });

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeCategoriesBottleneck().catch(console.error);