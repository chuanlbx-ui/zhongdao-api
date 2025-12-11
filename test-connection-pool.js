const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev'
    }
  }
});

async function testConnectionPool() {
  console.log('=== 连接池压力测试 ===');
  
  try {
    // 测试基础连接
    console.log('1. 测试基础连接...');
    await prisma.();
    console.log('   连接成功');
    
    // 测试并发查询
    console.log('2. 测试5个并发查询...');
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        prisma.productCategories.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            level: true,
            parentId: true,
            sort: true
          },
          orderBy: [
            { level: 'asc' },
            { sort: 'asc' }
          ],
          skip: i * 2,
          take: 5
        })
      );
    }
    
    await Promise.all(promises);
    const time = Date.now() - start;
    console.log('   5个并发查询完成，耗时: ' + time + 'ms');
    console.log('   平均每个查询: ' + (time / 5) + 'ms');
    
    await prisma.();
    console.log('连接池测试完成');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testConnectionPool();
