// 测试简化版交易记录查询
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDirectQuery() {
  console.log('Test 1: 直接查询 fromUserId');
  const start1 = Date.now();
  const fromTxs = await prisma.pointsTransactions.findMany({
    where: {
      fromUserId: 'xlexb35vac2jq40wngr1sfca'
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log(`From查询结果: ${fromTxs.length}条, 耗时: ${Date.now() - start1}ms`);

  console.log('\nTest 2: 直接查询 toUserId');
  const start2 = Date.now();
  const toTxs = await prisma.pointsTransactions.findMany({
    where: {
      toUserId: 'xlexb35vac2jq40wngr1sfca'
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log(`To查询结果: ${toTxs.length}条, 耗时: ${Date.now() - start2}ms`);

  console.log('\nTest 3: 使用OR查询（原始方式）');
  const start3 = Date.now();
  const orTxs = await prisma.pointsTransactions.findMany({
    where: {
      OR: [
        { fromUserId: 'xlexb35vac2jq40wngr1sfca' },
        { toUserId: 'xlexb35vac2jq40wngr1sfca' }
      ]
    },
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  console.log(`OR查询结果: ${orTxs.length}条, 耗时: ${Date.now() - start3}ms`);

  console.log('\nTest 4: 统计记录数');
  const start4 = Date.now();
  const [fromCount, toCount] = await Promise.all([
    prisma.pointsTransactions.count({
      where: { fromUserId: 'xlexb35vac2jq40wngr1sfca' }
    }),
    prisma.pointsTransactions.count({
      where: { toUserId: 'xlexb35vac2jq40wngr1sfca' }
    })
  ]);
  console.log(`统计结果: from=${fromCount}, to=${toCount}, 耗时: ${Date.now() - start4}ms`);
}

testDirectQuery()
  .catch(console.error)
  .finally(() => prisma.$disconnect());