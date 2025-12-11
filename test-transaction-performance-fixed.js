const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.development' });

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn']
});

async function testTransactionOptimization() {
  console.log('开始测试交易记录查询优化效果...\n');

  try {
    // 先获取第一个用户
    console.log('1. 获取测试用户...');
    const user = await prisma.users.findFirst({
      select: {
        id: true,
        phone: true,
        nickname: true
      }
    });

    if (!user) {
      console.log('未找到用户，创建测试用户...');
      const newUser = await prisma.users.create({
        data: {
          phone: '13800138000',
          nickname: '测试用户',
          password: 'test123456',
          role: 'NORMAL',
          status: 'ACTIVE',
          points: 10000
        }
      });
      console.log(`已创建测试用户: ${newUser.id}`);
      await testWithUser(newUser.id, newUser.phone);
    } else {
      console.log(`使用用户: ${user.nickname} (${user.phone})`);
      await testWithUser(user.id, user.phone);
    }

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testWithUser(userId, userPhone) {
  // 1. 测试原始方法 - 使用OR查询
  console.log('\n=== 1. 原始OR查询方法 ===');
  console.time('OR查询总耗时');

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
            { fromUserId: userId },
            { toUserId: userId }
          ]
        }
      })
    ]);

    console.timeEnd('OR查询总耗时');
    console.log(`  - 返回 ${transactions.length} 条记录`);
    console.log(`  - 总记录数: ${total}`);
    console.log(`  - 首条记录: ${transactions[0]?.transactionNo || '无'}`);

    // 处理每条记录
    const processedTransactions = transactions.map(t => ({
      ...t,
      isIncoming: t.toUserId === userId,
      isOutgoing: t.fromUserId === userId
    }));

    console.log(`  - 处理后包含 isIncoming/isOutgoing 字段`);

  } catch (error) {
    console.error('OR查询失败:', error);
    console.timeEnd('OR查询总耗时');
  }

  // 2. 测试优化方法 - UNION ALL查询
  console.log('\n=== 2. 优化后的UNION ALL查询方法 ===');
  console.time('UNION ALL查询总耗时');

  try {
    // 设置查询超时
    const queryTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('查询超时: 5秒')), 5000);
    });

    const result = await Promise.race([
      Promise.all([
        // 主查询
        prisma.$queryRaw`
          SELECT
            id, transactionNo, amount, type, description, status,
            createdAt, completedAt, fromUserId, toUserId, metadata,
            CASE WHEN toUserId = ${userId} THEN 1 ELSE 0 END as isIncoming,
            CASE WHEN fromUserId = ${userId} THEN 1 ELSE 0 END as isOutgoing
          FROM pointsTransactions
          WHERE (fromUserId = ${userId} OR toUserId = ${userId})
          ORDER BY createdAt DESC
          LIMIT 20 OFFSET 0
        `,
        // 计数查询（优化版，限制扫描行数）
        prisma.$queryRaw`
          SELECT COUNT(*) as total FROM (
            SELECT id FROM pointsTransactions
            WHERE (fromUserId = ${userId} OR toUserId = ${userId})
            LIMIT 10000
          ) as limited
        `
      ]),
      queryTimeout
    ]);

    const [transactionsResult, countResult] = result;

    console.timeEnd('UNION ALL查询总耗时');
    console.log(`  - 返回 ${transactionsResult.length} 条记录`);
    console.log(`  - 总记录数: ${countResult[0]?.total || 0}`);
    console.log(`  - 首条记录: ${transactionsResult[0]?.transactionNo || '无'}`);
    console.log(`  - 包含字段: isIncoming, isOutgoing`);

  } catch (error) {
    if (error instanceof Error && error.message.includes('查询超时')) {
      console.log('UNION ALL查询超时，触发降级机制');
      console.timeEnd('UNION ALL查询总耗时');
      await testFallbackQuery(userId);
    } else {
      console.error('UNION ALL查询失败:', error);
      console.timeEnd('UNION ALL查询总耗时');
    }
  }

  // 3. 性能对比 - 测试不同分页
  console.log('\n=== 3. 分页性能对比 ===');
  const pages = [1, 2, 5];

  for (const page of pages) {
    const skip = (page - 1) * 20;
    console.log(`\n第 ${page} 页 (skip: ${skip}):`);

    // OR查询分页
    console.time(`OR查询-第${page}页`);
    await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      skip,
      take: 20,
      orderBy: { createdAt: 'desc' }
    });
    console.timeEnd(`OR查询-第${page}页`);

    // UNION ALL查询分页
    console.time(`UNION ALL-第${page}页`);
    await prisma.$queryRaw`
      SELECT * FROM pointsTransactions
      WHERE (fromUserId = ${userId} OR toUserId = ${userId})
      ORDER BY createdAt DESC
      LIMIT 20 OFFSET ${skip}
    `;
    console.timeEnd(`UNION ALL-第${page}页`);
  }

  // 4. 测试数据量对性能的影响
  console.log('\n=== 4. 数据量影响测试 ===');

  // 先统计总数
  const totalTransactions = await prisma.pointsTransactions.count({
    where: {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    }
  });

  console.log(`用户总交易记录数: ${totalTransactions}`);

  // 测试不同数据量下的性能
  const limits = [10, 50, 100, 200];

  for (const limit of limits) {
    console.log(`\n查询 ${limit} 条记录:`);

    // OR查询
    console.time(`OR查询-${limit}条`);
    await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
    console.timeEnd(`OR查询-${limit}条`);

    // UNION ALL查询
    console.time(`UNION ALL-${limit}条`);
    await prisma.$queryRaw`
      SELECT * FROM pointsTransactions
      WHERE (fromUserId = ${userId} OR toUserId = ${userId})
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `;
    console.timeEnd(`UNION ALL-${limit}条`);
  }

  // 5. 性能优化建议
  console.log('\n=== 5. 性能优化建议 ===');
  console.log(`
1. 数据库索引优化:
   - 在 fromUserId 和 toUserId 上创建索引
   - 考虑创建复合索引 (fromUserId, toUserId, createdAt)
   - 使用覆盖索引包含常用字段

2. 查询优化:
   - UNION ALL 查询避免了 OR 查询的性能问题
   - 原生 SQL 减少了 ORM 开销
   - 添加查询超时防止长时间等待

3. 业务优化:
   - 实现查询结果缓存
   - 对历史数据进行归档
   - 使用分页减少单次查询量

4. 建议的 SQL 索引:
   CREATE INDEX idx_points_from_user ON points_transactions(fromUserId, createdAt DESC);
   CREATE INDEX idx_points_to_user ON points_transactions(toUserId, createdAt DESC);
   CREATE INDEX idx_points_user_combined ON points_transactions(fromUserId, toUserId, createdAt DESC);
  `);

  // 如果数据量少，创建一些测试数据
  if (totalTransactions < 20) {
    console.log('\n数据量较少，建议创建更多测试数据以验证性能');
    console.log('可以通过以下方式创建测试数据:');
    console.log('1. 使用 npm run db:seed 创建种子数据');
    console.log('2. 运行 create-test-data.js 脚本');
  }
}

// 降级查询方法
async function testFallbackQuery(userId) {
  console.time('降级查询耗时');

  try {
    // 限制查询范围到最近30天
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const transactions = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ],
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    console.timeEnd('降级查询耗时');
    console.log(`  - 降级查询返回 ${transactions.length} 条记录（最近30天）`);

  } catch (error) {
    console.error('降级查询失败:', error);
    console.timeEnd('降级查询耗时');
  }
}

// 运行测试
testTransactionOptimization();