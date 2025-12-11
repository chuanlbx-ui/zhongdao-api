import { config } from 'dotenv';
import { prisma } from './src/shared/database/client';

// 加载环境变量
config({ path: '.env.development' });

async function testTransactionOptimization() {
  console.log('开始测试交易记录查询优化效果...\n');

  try {
    // 获取第一个用户
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        phone: true,
        nickname: true
      }
    });

    if (!user) {
      console.log('未找到用户，先创建测试用户...');
      const newUser = await prisma.user.create({
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

      // 为新用户创建一些交易记录
      await createTestTransactions(newUser.id);
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

async function testWithUser(userId: string, userPhone: string) {
  // 1. 测试原始方法 - 使用OR查询
  console.log('\n=== 1. 原始OR查询方法 ===');
  console.time('OR查询耗时');

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

    console.timeEnd('OR查询耗时');
    console.log(`  - 返回 ${transactions.length} 条记录`);
    console.log(`  - 总记录数: ${total}`);
    console.log(`  - 首条记录: ${transactions[0]?.transactionNo || '无'}`);
    console.log(`  - 时间范围: ${transactions[transactions.length - 1]?.createdAt?.toISOString() || '无'} ~ ${transactions[0]?.createdAt?.toISOString() || '无'}`);

  } catch (error) {
    console.error('OR查询失败:', error);
    console.timeEnd('OR查询耗时');
  }

  // 2. 测试优化方法 - UNION ALL查询
  console.log('\n=== 2. 优化后的UNION ALL查询方法 ===');
  console.time('UNION ALL查询耗时');

  try {
    // 设置查询超时
    const queryTimeout = new Promise<never>((_, reject) => {
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
          FROM points_transactions
          WHERE (fromUserId = ${userId} OR toUserId = ${userId})
          ORDER BY createdAt DESC
          LIMIT 20 OFFSET 0
        `,
        // 计数查询（优化版，限制扫描行数）
        prisma.$queryRaw`
          SELECT COUNT(*) as total FROM (
            SELECT id FROM points_transactions
            WHERE (fromUserId = ${userId} OR toUserId = ${userId})
            LIMIT 10000
          ) as limited
        `
      ]),
      queryTimeout
    ]);

    const [transactionsResult, countResult] = result as any[];

    console.timeEnd('UNION ALL查询耗时');
    console.log(`  - 返回 ${transactionsResult.length} 条记录`);
    console.log(`  - 总记录数: ${countResult[0]?.total || 0}`);
    console.log(`  - 首条记录: ${transactionsResult[0]?.transactionNo || '无'}`);
    console.log(`  - 包含字段: isIncoming, isOutgoing`);

  } catch (error) {
    if (error instanceof Error && error.message.includes('查询超时')) {
      console.log('UNION ALL查询超时，触发降级机制');
      console.timeEnd('UNION ALL查询耗时');
      await testFallbackQuery(userId);
    } else {
      console.error('UNION ALL查询失败:', error);
      console.timeEnd('UNION ALL查询耗时');
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
      SELECT * FROM points_transactions
      WHERE (fromUserId = ${userId} OR toUserId = ${userId})
      ORDER BY createdAt DESC
      LIMIT 20 OFFSET ${skip}
    `;
    console.timeEnd(`UNION ALL-第${page}页`);
  }

  // 4. 降级查询测试
  console.log('\n=== 4. 降级查询测试 ===');
  await testFallbackQuery(userId);

  // 5. 索引建议
  console.log('\n=== 5. 索引优化建议 ===');
  console.log('建议创建以下索引以提升性能:');
  console.log(`
  CREATE INDEX idx_points_from_user ON points_transactions(fromUserId, createdAt DESC);
  CREATE INDEX idx_points_to_user ON points_transactions(toUserId, createdAt DESC);
  CREATE INDEX idx_points_user_date ON points_transactions(fromUserId, toUserId, createdAt DESC);

  -- 或者使用覆盖索引（包含常用字段）
  CREATE INDEX idx_points_cover ON points_transactions(fromUserId, toUserId, createdAt DESC, type, status);
  `);
}

// 降级查询方法
async function testFallbackQuery(userId: string) {
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
    console.log(`  - 数据范围: ${transactions[transactions.length - 1]?.createdAt?.toISOString()} ~ ${transactions[0]?.createdAt?.toISOString()}`);

  } catch (error) {
    console.error('降级查询失败:', error);
    console.timeEnd('降级查询耗时');
  }
}

// 创建测试交易数据
async function createTestTransactions(userId: string) {
  console.log('\n创建测试交易数据...');

  const transactions = [];
  const types = ['TRANSFER', 'RECHARGE', 'WITHDRAW', 'COMMISSION', 'PURCHASE'];

  // 创建100条测试记录
  for (let i = 0; i < 100; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const isIncoming = type === 'RECHARGE' || type === 'COMMISSION';
    const date = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000); // 随机60天内

    transactions.push({
      transactionNo: `PT${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      fromUserId: isIncoming ? null : userId,
      toUserId: isIncoming ? userId : null,
      amount: Math.floor(Math.random() * 10000) + 100,
      type: type as any,
      description: `测试交易 #${i + 1}`,
      status: 'COMPLETED',
      balanceBefore: 50000,
      balanceAfter: 45000,
      metadata: { test: true },
      createdAt: date,
      completedAt: date
    });
  }

  await prisma.pointsTransactions.createMany({
    data: transactions,
    skipDuplicates: true
  });

  console.log(`已创建 ${transactions.length} 条测试交易记录`);
}

// 运行测试
testTransactionOptimization();