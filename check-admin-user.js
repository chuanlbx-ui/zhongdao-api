const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
    }
  }
});

async function checkAdminUser() {
  try {
    const users = await prisma.users.findMany({
      where: {
        OR: [
          { phone: { contains: '18800000001' } },
          { level: 'DIRECTOR' }
        ]
      },
      select: {
        id: true,
        phone: true,
        nickname: true,
        level: true,
        status: true,
        createdAt: true
      }
    });

    console.log('=== 查询管理员用户 ===');
    console.log('找到', users.length, '个相关用户');
    users.forEach(user => {
      console.log(`- ID: ${user.id}`);
      console.log(`  手机号: ${user.phone || 'null'}`);
      console.log(`  昵称: ${user.nickname || 'null'}`);
      console.log(`  等级: ${user.level}`);
      console.log(`  状态: ${user.status}`);
      console.log(`  创建时间: ${user.createdAt}`);
      console.log('---');
    });
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUser();