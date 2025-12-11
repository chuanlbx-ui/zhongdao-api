const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

// 直接测试积分服务，绕过JWT
const prisma = new PrismaClient();

async function testPointsService() {
  try {
    console.log('Testing points service...\n');

    // 1. 测试获取用户
    const userId = 'aiwlm3azfr6ryc2mx64mqo6b';
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        pointsBalance: true,
        pointsFrozen: true,
        level: true,
        status: true
      }
    });

    console.log('1. User found:', user);

    // 2. 测试创建积分交易记录
    if (user) {
      console.log('\n2. Creating test transaction...');
      const transactionNo = `PT${Date.now()}TEST`;
      const transactionId = randomBytes(12).toString('hex');
      const transaction = await prisma.pointsTransactions.create({
        data: {
          id: transactionId,
          transactionNo,
          fromUserId: userId,
          toUserId: userId,
          amount: 100,
          type: 'RECHARGE',
          description: 'Test recharge',
          status: 'COMPLETED',
          balanceBefore: user.pointsBalance,
          balanceAfter: user.pointsBalance + 100
        }
      });
      console.log('Transaction created:', transaction.id);

      // 3. 更新用户余额
      console.log('\n3. Updating user balance...');
      const updatedUser = await prisma.users.update({
        where: { id: userId },
        data: {
          pointsBalance: user.pointsBalance + 100
        }
      });
      console.log('Updated balance:', updatedUser.pointsBalance);

      // 4. 查询交易记录
      console.log('\n4. Querying transactions...');
      const transactions = await prisma.pointsTransactions.findMany({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId }
          ]
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          type: true,
          description: true,
          createdAt: true
        }
      });
      console.log('Recent transactions:', transactions);
    }

    console.log('\n✅ Points service test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testPointsService();