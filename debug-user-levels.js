const { PrismaClient } = require('@prisma/client');

async function debugUserLevels() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('查看测试用户的level值:\n');

    // 查找测试用户
    const testUsers = await prisma.users.findMany({
      where: {
        phone: { startsWith: '1880000' }
      },
      select: {
        id: true,
        phone: true,
        nickname: true,
        level: true,
        status: true
      }
    });

    console.log('测试用户列表:');
    testUsers.forEach(user => {
      console.log(`- ${user.phone} (${user.nickname}): level="${user.level}", status="${user.status}"`);
    });

    // 检查VIP用户
    const vipUser = testUsers.find(u => u.phone === '18800000003');
    if (vipUser) {
      console.log(`\nVIP用户详情:`);
      console.log(`- ID: ${vipUser.id}`);
      console.log(`- Level: "${vipUser.level}"`);
      console.log(`- 检查是否为VIP: ${vipUser.level === 'VIP' ? '是' : '否'}`);
      console.log(`- 检查是否为normal: ${vipUser.level === 'NORMAL' ? '是' : '否'}`);
    } else {
      console.log('\n❌ 没有找到VIP用户 (18800000003)');
    }

    // 检查星级用户
    const starUser = testUsers.find(u => u.phone === '18800000004');
    if (starUser) {
      console.log(`\n星级用户详情:`);
      console.log(`- ID: ${starUser.id}`);
      console.log(`- Level: "${starUser.level}"`);
      console.log(`- 检查是否以STAR_开头: ${starUser.level.startsWith('STAR_') ? '是' : '否'}`);
    } else {
      console.log('\n❌ 没有找到星级用户 (18800000004)');
    }

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUserLevels();