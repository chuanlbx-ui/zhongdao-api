const { PrismaClient } = require('@prisma/client');

async function testShopsDB() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('检查shops表是否存在...');
    const shopCount = await prisma.shops.count();
    console.log(`shops表中有 ${shopCount} 条记录`);

    if (shopCount > 0) {
      const sampleShop = await prisma.shops.findFirst();
      console.log('示例店铺:', sampleShop);
    }

    // 检查users表
    console.log('\n检查users表...');
    const userCount = await prisma.users.count();
    console.log(`users表中有 ${userCount} 条记录`);

    // 查找VIP用户
    const vipUser = await prisma.users.findFirst({
      where: { level: 'VIP' }
    });
    console.log('VIP用户:', vipUser ? { id: vipUser.id, phone: vipUser.phone, level: vipUser.level } : null);

  } catch (error) {
    console.error('数据库错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testShopsDB();