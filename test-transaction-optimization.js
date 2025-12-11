const { PrismaClient } = require('@prisma/client');
const { performance } = require('perf_hooks');

const prisma = new PrismaClient();

// 测试交易记录查询性能
async function testTransactionPerformance() {
  console.log('开始测试交易记录查询性能...\n');

  // 获取一个测试用户ID
  const testUser = await prisma.user.findFirst({
    select: { id: true }
  });

  if (!testUser) {
    console.log('未找到用户，请先创建测试用户');
    return;
  }

  const userId = testUser.id;
  console.log(`使用测试用户ID: ${userId}\n`);

  // 测试场景1：使用OR查询（原始方法）
  console.log('=== 测试场景1: OR查询（原始方法） ===');
  await testWithORQuery(userId);

  // 测试场景2：使用UNION ALL（优化方法）
  console.log('\n=== 测试场景2: UNION ALL查询（优化方法） ===');
  await testWithUnionAll(userId);

  // 测试场景3：大量数据下的性能对比
  console.log('\n=== 测试场景3: 大量数据性能对比 ===');
  await testLargeDataset(userId);
}

// 测试OR查询方法
async function testWithORQuery(userId) {
  const iterations = 5;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      const [transactions, total] = await Promise.all([
        prisma.pointsTransactions.findMany({
          where: {
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            type: true,
            createdAt: true,
            fromUserId: true,
            toUserId: true
          }
        }),
        prisma.pointsTransactions.count({
          where: {
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          }
        })
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;
      times.push(duration);

      console.log(`  第${i + 1}次: ${duration.toFixed(2)}ms, 返回${transactions.length}条记录, 总数${total}`);
    } catch (error) {
      console.error(`  第${i + 1}次失败:`, error.message);
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n  平均耗时: ${avgTime.toFixed(2)}ms`);
  console.log(`  最快: ${Math.min(...times).toFixed(2)}ms`);
  console.log(`  最慢: ${Math.max(...times).toFixed(2)}ms`);
}

// 测试UNION ALL方法
async function testWithUnionAll(userId) {
  const iterations = 5;
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();

    try {
      const baseQuery = `
        (SELECT
          id, transactionNo, amount, type, description, status,
          createdAt, completedAt, fromUserId, toUserId, metadata,
          CASE WHEN toUserId = '${userId}' THEN 1 ELSE 0 END as isIncoming,
          CASE WHEN fromUserId = '${userId}' THEN 1 ELSE 0 END as isOutgoing
         FROM points_transactions
         WHERE (fromUserId = '${userId}' OR toUserId = '${userId}'))
      `;

      const [transactionsResult, countResult] = await Promise.all([
        prisma.$queryRaw`
          SELECT * FROM (${baseQuery}) AS combined
          ORDER BY createdAt DESC
          LIMIT 20 OFFSET 0
        `,
        prisma.$queryRaw`
          SELECT COUNT(*) as total FROM (
            SELECT id FROM points_transactions
            WHERE (fromUserId = ${userId} OR toUserId = ${userId})
            LIMIT 10000
          ) as limited
        `
      ]);

      const endTime = performance.now();
      const duration = endTime - startTime;
      times.push(duration);

      console.log(`  第${i + 1}次: ${duration.toFixed(2)}ms, 返回${transactionsResult.length}条记录, 总数${countResult[0].total}`);
    } catch (error) {
      console.error(`  第${i + 1}次失败:`, error.message);
    }
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`\n  平均耗时: ${avgTime.toFixed(2)}ms`);
  console.log(`  最快: ${Math.min(...times).toFixed(2)}ms`);
  console.log(`  最慢: ${Math.max(...times).toFixed(2)}ms`);
}

// 测试大数据集性能
async function testLargeDataset(userId) {
  // 测试不同分页大小的性能
  const pageSizes = [10, 20, 50, 100];

  console.log('\n  OR查询性能:');
  for (const pageSize of pageSizes) {
    const startTime = performance.now();

    await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      take: pageSize,
      orderBy: { createdAt: 'desc' }
    });

    const duration = performance.now() - startTime;
    console.log(`    页大小${pageSize}: ${duration.toFixed(2)}ms`);
  }

  console.log('\n  UNION ALL查询性能:');
  for (const pageSize of pageSizes) {
    const startTime = performance.now();

    await prisma.$queryRaw`
      SELECT * FROM points_transactions
      WHERE (fromUserId = ${userId} OR toUserId = ${userId})
      ORDER BY createdAt DESC
      LIMIT ${pageSize}
    `;

    const duration = performance.now() - startTime;
    console.log(`    页大小${pageSize}: ${duration.toFixed(2)}ms`);
  }
}

// 创建大量测试数据
async function createTestData() {
  console.log('\n创建测试数据...');

  // 使用第一个用户作为测试用户
  const testUser = await prisma.user.findFirst({
    select: { id: true }
  });

  if (!testUser) {
    console.log('请先创建用户');
    return;
  }

  const userId = testUser.id;
  const batchSize = 1000;
  const batches = 5; // 创建5000条记录

  for (let batch = 0; batch < batches; batch++) {
    const transactions = [];

    for (let i = 0; i < batchSize; i++) {
      const isIncoming = Math.random() > 0.5;
      const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

      transactions.push({
        transactionNo: `PT${Date.now()}${Math.random().toString(36).substring(2, 8)}`.toUpperCase(),
        fromUserId: isIncoming ? null : userId,
        toUserId: isIncoming ? userId : null,
        amount: Math.floor(Math.random() * 10000) + 1,
        type: isIncoming ? 'RECHARGE' : 'TRANSFER',
        description: `测试交易 ${batch * batchSize + i}`,
        status: 'COMPLETED',
        balanceBefore: 100000,
        balanceAfter: 90000,
        createdAt: timestamp,
        completedAt: timestamp
      });
    }

    await prisma.pointsTransactions.createMany({
      data: transactions,
      skipDuplicates: true
    });

    console.log(`已创建批次 ${batch + 1}/${batches}`);
  }

  console.log('测试数据创建完成');
}

// 运行测试
async function main() {
  try {
    // 先检查是否有足够的测试数据
    const transactionCount = await prisma.pointsTransactions.count();

    if (transactionCount < 1000) {
      console.log(`当前交易记录数: ${transactionCount}, 创建更多测试数据...`);
      await createTestData();
    }

    await testTransactionPerformance();

    // 输出性能优化建议
    console.log('\n=== 性能优化建议 ===');
    console.log('1. 在fromUserId和toUserId上创建复合索引');
    console.log('2. 考虑使用数据库分区（按时间分区）');
    console.log('3. 实现查询结果缓存');
    console.log('4. 对于历史数据，考虑归档到单独的表');

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();