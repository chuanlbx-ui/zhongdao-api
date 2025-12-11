require('dotenv').config({ path: '.env.test' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['info'],
});

async function testTransactionService() {
  try {
    console.log('='.repeat(60));
    console.log('直接测试TransactionService性能');
    console.log('='.repeat(60));

    const userId = 'aiwlm3azfr6ryc2mx64mqo6b'; // 有交易记录的用户
    const page = 1;
    const perPage = 5;
    const skip = (page - 1) * perPage;

    const where = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };

    console.log('1. Testing count query...');
    const countStart = Date.now();
    const total = await prisma.pointsTransactions.count({ where });
    console.log(`   Count result: ${total} (took ${Date.now() - countStart}ms)`);

    console.log('\n2. Testing findMany query...');
    const findStart = Date.now();
    const transactions = await prisma.pointsTransactions.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        type: true,
        description: true,
        status: true,
        createdAt: true,
        completedAt: true,
        fromUserId: true,
        toUserId: true,
        metadata: true
      }
    });
    console.log(`   Found ${transactions.length} transactions (took ${Date.now() - findStart}ms)`);

    console.log('\n3. Testing Promise.all (both queries together)...');
    const promiseStart = Date.now();
    const [t1, t2] = await Promise.all([
      prisma.pointsTransactions.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNo: true,
          amount: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          completedAt: true,
          fromUserId: true,
          toUserId: true,
          metadata: true
        }
      }),
      prisma.pointsTransactions.count({ where })
    ]);
    console.log(`   Promise.all completed (took ${Date.now() - promiseStart}ms)`);
    console.log(`   Transactions: ${t1.length}, Count: ${t2}`);

    console.log('\n✅ Transaction service test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testTransactionService();