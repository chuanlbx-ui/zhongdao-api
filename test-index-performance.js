const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testIndexPerformance() {
  console.log('测试积分交易记录查询性能...\n');

  try {
    // 测试1: 获取所有交易记录
    console.log('1. 测试获取所有交易记录（不带过滤）');
    const start1 = Date.now();
    const allTransactions = await prisma.pointsTransactions.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const time1 = Date.now() - start1;
    console.log(`   - 查询时间: ${time1}ms`);
    console.log(`   - 返回记录数: ${allTransactions.length}`);
    console.log('');

    // 测试2: 按fromUserId过滤
    console.log('2. 测试按fromUserId过滤');
    const start2 = Date.now();
    const fromUserTransactions = await prisma.pointsTransactions.findMany({
      where: { fromUserId: 'admin' },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const time2 = Date.now() - start2;
    console.log(`   - 查询时间: ${time2}ms`);
    console.log(`   - 返回记录数: ${fromUserTransactions.length}`);
    console.log('');

    // 测试3: 按toUserId过滤
    console.log('3. 测试按toUserId过滤');
    const start3 = Date.now();
    const toUserTransactions = await prisma.pointsTransactions.findMany({
      where: { toUserId: 'admin' },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const time3 = Date.now() - start3;
    console.log(`   - 查询时间: ${time3}ms`);
    console.log(`   - 返回记录数: ${toUserTransactions.length}`);
    console.log('');

    // 测试4: 复合查询（fromUserId + toUserId）
    console.log('4. 测试复合查询（fromUserId + toUserId）');
    const start4 = Date.now();
    const complexTransactions = await prisma.pointsTransactions.findMany({
      where: {
        fromUserId: 'admin',
        toUserId: 'user_001'
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const time4 = Date.now() - start4;
    console.log(`   - 查询时间: ${time4}ms`);
    console.log(`   - 返回记录数: ${complexTransactions.length}`);
    console.log('');

    // 测试5: 按交易类型过滤
    console.log('5. 测试按交易类型过滤');
    const start5 = Date.now();
    const typeTransactions = await prisma.pointsTransactions.findMany({
      where: { type: 'TRANSFER' },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    const time5 = Date.now() - start5;
    console.log(`   - 查询时间: ${time5}ms`);
    console.log(`   - 返回记录数: ${typeTransactions.length}`);
    console.log('');

    // 性能总结
    console.log('性能测试总结:');
    console.log('================');
    const totalTime = time1 + time2 + time3 + time4 + time5;
    const avgTime = totalTime / 5;
    console.log(`总查询时间: ${totalTime}ms`);
    console.log(`平均查询时间: ${avgTime.toFixed(2)}ms`);

    if (avgTime < 100) {
      console.log('✅ 性能优秀！索引生效良好。');
    } else if (avgTime < 500) {
      console.log('⚠️  性能一般，可能需要进一步优化。');
    } else {
      console.log('❌ 性能较差，需要进一步优化。');
    }

  } catch (error) {
    console.error('测试出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行测试
testIndexPerformance();