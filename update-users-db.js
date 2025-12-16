// 更新数据库中的用户数据
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev'
    }
  }
});

async function updateUsers() {
  try {
    console.log('连接数据库...');

    // 更新用户数据
    const updates = [
      { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', pointsBalance: 1000 },
      { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', pointsBalance: 3200 },
      { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', pointsBalance: 8500 },
      { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', pointsBalance: 15000 },
      { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', pointsBalance: 200 },
      { id: '6', nickname: '孙八', phone: '13911111006', level: 'VIP', pointsBalance: 800 },
      { id: '7', nickname: '周九', phone: '13911111007', level: 'STAR_1', pointsBalance: 2800 },
      { id: '8', nickname: '吴十', phone: '13911111008', level: 'STAR_2', pointsBalance: 7200 },
      { id: '9', nickname: '郑十一', phone: '13911111009', level: 'DIRECTOR', pointsBalance: 50000 }
    ];

    console.log('\n更新用户数据...');
    for (const user of updates) {
      await prisma.users.upsert({
        where: { id: user.id },
        update: user,
        create: {
          ...user,
          openid: `openid_${user.id}`,
          status: 'ACTIVE',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date()
        }
      });
      console.log(`✅ 更新用户: ${user.nickname} (${user.level})`);
    }

    // 查询总数
    const totalUsers = await prisma.users.count();
    console.log(`\n📊 数据库中总用户数: ${totalUsers}`);

    // 查询最新用户
    const latestUsers = await prisma.users.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nickname: true,
        phone: true,
        level: true,
        pointsBalance: true,
        status: true,
        createdAt: true
      }
    });

    console.log('\n最新的5个用户:');
    latestUsers.forEach(user => {
      console.log(`  - ${user.nickname} (${user.level}) - ${user.phone} - ¥${user.pointsBalance}`);
    });

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUsers();