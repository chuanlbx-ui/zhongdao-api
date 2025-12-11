const { PrismaClient } = require('@prisma/client');

async function testPrisma() {
  console.log('测试Prisma连接...');
  const prisma = new PrismaClient();

  try {
    // 测试简单查询
    console.log('1. 测试连接...');
    await prisma.$connect();
    console.log('连接成功');

    // 测试用户查询
    console.log('2. 测试用户查询...');
    const start = Date.now();
    const user = await prisma.users.findUnique({
      where: { id: 'xlexb35vac2jq40wngr1sfca' },
      select: { id: true, nickname: true }
    });
    console.log(`用户查询完成: ${Date.now() - start}ms`, user ? '找到用户' : '用户不存在');

    // 测试交易查询
    console.log('3. 测试交易查询...');
    const start2 = Date.now();
    const count = await prisma.pointsTransactions.count({
      where: {
        OR: [
          { fromUserId: 'xlexb35vac2jq40wngr1sfca' },
          { toUserId: 'xlexb35vac2jq40wngr1sfca' }
        ]
      }
    });
    console.log(`交易计数完成: ${Date.now() - start2}ms, 总数: ${count}`);

    // 测试带分页的交易查询
    console.log('4. 测试分页交易查询...');
    const start3 = Date.now();
    const txs = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: 'xlexb35vac2jq40wngr1sfca' },
          { toUserId: 'xlexb35vac2jq40wngr1sfca' }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        type: true,
        createdAt: true
      }
    });
    console.log(`分页查询完成: ${Date.now() - start3}ms, 记录数: ${txs.length}`);

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
    console.log('断开连接');
  }
}

testPrisma();