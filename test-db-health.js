// 测试数据库健康状态
const { PrismaClient } = require('@prisma/client');

async function testDBHealth() {
  console.log('测试数据库连接...');
  const prisma = new PrismaClient();

  try {
    // 测试基本连接
    console.log('1. 测试连接...');
    await prisma.$connect();
    console.log('✓ 连接成功');

    // 测试数据库服务器状态
    console.log('2. 测试查询性能...');
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    console.log(`✓ 原始查询耗时: ${Date.now() - start}ms`);

    // 测试用户表
    console.log('3. 测试用户表查询...');
    const start2 = Date.now();
    const userCount = await prisma.users.count();
    console.log(`✓ 用户总数: ${userCount}, 耗时: ${Date.now() - start2}ms`);

    // 测试systemConfigs表（configService使用的）
    console.log('4. 测试系统配置表...');
    const start3 = Date.now();
    const configCount = await prisma.systemConfigs.count();
    console.log(`✓ 配置总数: ${configCount}, 耗时: ${Date.now() - start3}ms`);

    // 测试configService查询
    console.log('5. 测试configService查询...');
    const start4 = Date.now();
    const configs = await prisma.systemConfigs.findMany({
      where: {
        key: { in: ['points_default_page_size', 'points_max_page_size'] }
      }
    });
    console.log(`✓ 配置查询完成: ${Date.now() - start4}ms, 找到${configs.length}条`);

    // 测试交易记录表
    console.log('6. 测试交易记录表...');
    const start5 = Date.now();
    const txCount = await prisma.pointsTransactions.count();
    console.log(`✓ 交易记录总数: ${txCount}, 耗时: ${Date.now() - start5}ms`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n测试完成，断开连接');
  }
}

testDBHealth();