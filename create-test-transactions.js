const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestTransactions() {
  console.log('创建测试交易数据...\n');

  try {
    // 获取现有用户
    const users = await prisma.user.findMany({
      select: { id: true, role: true },
      take: 10
    });

    if (users.length < 2) {
      console.log('需要至少2个用户才能创建交易记录');
      return;
    }

    console.log(`找到 ${users.length} 个用户`);

    // 交易类型
    const transactionTypes = ['TRANSFER', 'PURCHASE', 'RECHARGE', 'COMMISSION', 'GIFT'];
    const transactionStatuses = ['COMPLETED', 'PENDING', 'FAILED'];

    // 创建测试交易记录
    const testTransactions = [];
    const batchSize = 1000;
    const totalBatches = 5; // 创建5000条测试数据

    for (let batch = 0; batch < totalBatches; batch++) {
      console.log(`创建第 ${batch + 1}/${totalBatches} 批数据...`);

      const batchTransactions = [];
      for (let i = 0; i < batchSize; i++) {
        const fromUser = users[Math.floor(Math.random() * users.length)];
        const toUser = users[Math.floor(Math.random() * users.length)];
        const type = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];

        // 确保fromUser和toUser不同
        if (fromUser.id !== toUser.id || type === 'RECHARGE') {
          batchTransactions.push({
            transactionNo: `TEST_TX_${Date.now()}_${batch}_${i}`,
            fromUserId: type === 'RECHARGE' ? null : fromUser.id,
            toUserId: toUser.id,
            amount: parseFloat((Math.random() * 1000).toFixed(2)),
            type,
            description: `测试交易 ${batch}_${i}`,
            status: transactionStatuses[Math.floor(Math.random() * transactionStatuses.length)],
            balanceBefore: parseFloat((Math.random() * 10000).toFixed(2)),
            balanceAfter: parseFloat((Math.random() * 10000).toFixed(2)),
            completedAt: Math.random() > 0.2 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null
          });
        }
      }

      // 批量创建
      const result = await prisma.pointsTransactions.createMany({
        data: batchTransactions,
        skipDuplicates: true
      });

      testTransactions.push(...batchTransactions);
      console.log(`  - 本批次创建 ${result.count} 条记录`);
    }

    console.log(`\n总共创建了 ${testTransactions.length} 条测试交易记录`);

    // 统计信息
    const totalTransactions = await prisma.pointsTransactions.count();
    console.log(`数据库中总交易记录数: ${totalTransactions}`);

  } catch (error) {
    console.error('创建测试数据出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行创建
createTestTransactions();