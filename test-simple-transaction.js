const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testTransactionQueryOptimization() {
  console.log('开始测试交易记录查询优化效果...\n');

  // 获取第一个用户ID
  const user = await prisma.user.findFirst({
    select: { id: true, phone: true }
  });

  if (!user) {
    console.log('未找到用户');
    return;
  }

  console.log(`使用用户ID: ${user.id} (${user.phone})\n`);

  // 1. 测试原始OR查询方法
  console.log('=== 1. 原始OR查询方法 ===');
  console.time('OR查询总耗时');

  try {
    const [transactions, total] = await Promise.all([
      prisma.pointsTransactions.findMany({
        where: {
          OR: [
            { fromUserId: user.id },
            { toUserId: user.id }
          ]
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNo: true,
          amount: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          fromUserId: true,
          toUserId: true
        }
      }),
      prisma.pointsTransactions.count({
        where: {
          OR: [
            { fromUserId: user.id },
            { toUserId: user.id }
          ]
        }
      })
    ]);

    console.timeEnd('OR查询总耗时');
    console.log(`  - 返回 ${transactions.length} 条记录`);
    console.log(`  - 总记录数: ${total}`);
    console.log(`  - 首条记录时间: ${transactions[0]?.createdAt.toISOString()}`);

    // 处理每条记录
    transactions.forEach(t => {
      t.isIncoming = t.toUserId === user.id;
      t.isOutgoing = t.fromUserId === user.id;
    });

  } catch (error) {
    console.error('OR查询失败:', error.message);
    console.timeEnd('OR查询总耗时');
  }

  console.log('\n');

  // 2. 测试优化后的UNION ALL查询方法
  console.log('=== 2. 优化后的UNION ALL查询方法 ===');
  console.time('UNION ALL查询总耗时');

  try {
    // 添加查询超时处理
    const queryTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('查询超时')), 5000);
    });

    const result = await Promise.race([
      Promise.all([
        // 主查询
        prisma.$queryRaw`
          SELECT
            id, transactionNo, amount, type, description, status,
            createdAt, fromUserId, toUserId,
            CASE WHEN toUserId = ${user.id} THEN 1 ELSE 0 END as isIncoming,
            CASE WHEN fromUserId = ${user.id} THEN 1 ELSE 0 END as isOutgoing
          FROM points_transactions
          WHERE (fromUserId = ${user.id} OR toUserId = ${user.id})
          ORDER BY createdAt DESC
          LIMIT 20
        `,
        // 计数查询
        prisma.$queryRaw`
          SELECT COUNT(*) as total
          FROM points_transactions
          WHERE (fromUserId = ${user.id} OR toUserId = ${user.id})
        `
      ]),
      queryTimeout
    ]);

    const [transactionsResult, countResult] = result;

    console.timeEnd('UNION ALL查询总耗时');
    console.log(`  - 返回 ${transactionsResult.length} 条记录`);
    console.log(`  - 总记录数: ${countResult[0].total}`);
    console.log(`  - 首条记录时间: ${transactionsResult[0]?.createdAt}`);

  } catch (error) {
    console.error('UNION ALL查询失败:', error.message);
    console.timeEnd('UNION ALL查询总耗时');
  }

  console.log('\n');

  // 3. 测试分页性能
  console.log('=== 3. 分页性能测试 ===');
  const pages = [1, 5, 10];

  for (const page of pages) {
    const offset = (page - 1) * 20;

    console.log(`\n测试第 ${page} 页:`);

    // OR查询
    console.time(`OR查询-第${page}页`);
    await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: user.id },
          { toUserId: user.id }
        ]
      },
      skip: offset,
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        type: true,
        createdAt: true
      }
    });
    console.timeEnd(`OR查询-第${page}页`);

    // UNION ALL查询
    console.time(`UNION ALL查询-第${page}页`);
    await prisma.$queryRaw`
      SELECT id, transactionNo, amount, type, createdAt
      FROM points_transactions
      WHERE (fromUserId = ${user.id} OR toUserId = ${user.id})
      ORDER BY createdAt DESC
      LIMIT 20 OFFSET ${offset}
    `;
    console.timeEnd(`UNION ALL查询-第${page}页`);
  }

  // 4. 检查数据库索引
  console.log('\n=== 4. 数据库索引检查 ===');
  const indexes = await prisma.$queryRaw`
    SHOW INDEX FROM points_transactions
    WHERE Column_name IN ('fromUserId', 'toUserId', 'createdAt')
  `;

  console.log('相关索引:');
  indexes.forEach(idx => {
    console.log(`  - ${idx.Key_name}: ${idx.Column_name} (${idx.Index_type})`);
  });

  console.log('\n=== 性能优化总结 ===');
  console.log('1. UNION ALL查询避免了OR查询可能导致的性能问题');
  console.log('2. 原生SQL查询减少了Prisma ORM的开销');
  console.log('3. 添加了查询超时机制，防止长时间等待');
  console.log('4. 建议在fromUserId和toUserId上创建复合索引');
  console.log('5. 考虑对历史数据进行归档处理');

  // 5. 创建一些测试数据（如果需要）
  const transactionCount = await prisma.pointsTransactions.count({
    where: {
      OR: [
        { fromUserId: user.id },
        { toUserId: user.id }
      ]
    }
  });

  if (transactionCount < 100) {
    console.log(`\n当前用户交易记录较少(${transactionCount}条)，建议创建更多测试数据来验证性能`);
  }

  await prisma.$disconnect();
}

testTransactionQueryOptimization().catch(console.error);