const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev'
    }
  }
});

async function createUsers() {
  try {
    console.log('🔌 连接数据库...');

    // 测试连接
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 检查users表
    const tableExists = await prisma.$queryRaw`SHOW TABLES LIKE 'users'`;
    if (tableExists.length === 0) {
      console.log('❌ users表不存在，请先运行数据库迁移');
      return;
    }
    console.log('✅ users表存在');

    // 清理旧数据
    console.log('\n🗑️ 清理旧的测试数据...');
    await prisma.users.deleteMany({
      where: {
        openid: {
          startsWith: 'test_'
        }
      }
    });

    // 创建测试用户
    console.log('\n👥 创建测试用户...');
    const users = [
      {
        id: 'test_user_001',
        openid: 'test_openid_001',
        nickname: '张三',
        phone: '13911111001',
        avatarUrl: 'https://ui-avatars.com/api/?name=张三&background=1890ff',
        level: 'NORMAL',
        status: 'ACTIVE',
        parentId: null,
        teamPath: null,
        teamLevel: 1,
        totalSales: 0,
        totalBottles: 0,
        directSales: 0,
        teamSales: 0,
        directCount: 0,
        teamCount: 0,
        pointsBalance: 100,
        pointsFrozen: 0,
        referralCode: 'TEST001'
      },
      {
        id: 'test_user_002',
        openid: 'test_openid_002',
        nickname: '李四',
        phone: '13800138002',
        avatarUrl: 'https://ui-avatars.com/api/?name=李四&background=52c41a',
        level: 'VIP',
        status: 'ACTIVE',
        parentId: 'test_user_001',
        teamPath: 'test_user_001',
        teamLevel: 2,
        totalSales: 5000,
        totalBottles: 50,
        directSales: 5000,
        teamSales: 5000,
        directCount: 5,
        teamCount: 10,
        pointsBalance: 1500,
        pointsFrozen: 0,
        referralCode: 'TEST002'
      },
      {
        id: 'test_user_003',
        openid: 'test_openid_003',
        nickname: '王五',
        phone: '13800138003',
        avatarUrl: 'https://ui-avatars.com/api/?name=王五&background=faad14',
        level: 'STAR_1',
        status: 'ACTIVE',
        parentId: 'test_user_001',
        teamPath: 'test_user_001',
        teamLevel: 2,
        totalSales: 15000,
        totalBottles: 150,
        directSales: 15000,
        teamSales: 15000,
        directCount: 15,
        teamCount: 30,
        pointsBalance: 3200,
        pointsFrozen: 0,
        referralCode: 'TEST003'
      },
      {
        id: 'test_user_004',
        openid: 'test_openid_004',
        nickname: '赵六',
        phone: '13800138004',
        avatarUrl: 'https://ui-avatars.com/api/?name=赵六&background=13c2c2',
        level: 'STAR_2',
        status: 'ACTIVE',
        parentId: 'test_user_001',
        teamPath: 'test_user_001',
        teamLevel: 2,
        totalSales: 50000,
        totalBottles: 500,
        directSales: 50000,
        teamSales: 50000,
        directCount: 25,
        teamCount: 60,
        pointsBalance: 8500,
        pointsFrozen: 0,
        referralCode: 'TEST004'
      },
      {
        id: 'test_user_005',
        openid: 'test_openid_005',
        nickname: '钱七',
        phone: '13800138005',
        avatarUrl: 'https://ui-avatars.com/api/?name=钱七&background=722ed1',
        level: 'STAR_3',
        status: 'ACTIVE',
        parentId: 'test_user_001',
        teamPath: 'test_user_001',
        teamLevel: 2,
        totalSales: 120000,
        totalBottles: 1200,
        directSales: 120000,
        teamSales: 120000,
        directCount: 40,
        teamCount: 100,
        pointsBalance: 15000,
        pointsFrozen: 0,
        referralCode: 'TEST005'
      },
      {
        id: 'test_user_006',
        openid: 'test_openid_006',
        nickname: '孙八',
        phone: '13800138006',
        avatarUrl: 'https://ui-avatars.com/api/?name=孙八&background=8c8c8c',
        level: 'NORMAL',
        status: 'ACTIVE',
        parentId: 'test_user_002',
        teamPath: 'test_user_001,test_user_002',
        teamLevel: 3,
        totalSales: 800,
        totalBottles: 8,
        directSales: 800,
        teamSales: 800,
        directCount: 2,
        teamCount: 4,
        pointsBalance: 200,
        pointsFrozen: 0,
        referralCode: 'TEST006'
      }
    ];

    // 插入用户数据
    for (const userData of users) {
      const user = await prisma.users.create({
        data: {
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`  ✓ ${user.nickname} (${user.level}) - 通券: ${user.pointsBalance}`);
    }

    // 统计信息
    const totalUsers = await prisma.users.count();
    const levelStats = await prisma.users.groupBy({
      by: ['level'],
      _count: { level: true }
    });

    console.log('\n📊 数据统计:');
    console.log(`  总用户数: ${totalUsers}`);
    levelStats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat._count.level} 人`);
    });

    console.log('\n✅ 测试用户创建成功！');
    console.log('\n🌐 现在可以在管理后台查看数据:');
    console.log('   http://localhost:5174/users');
    console.log('   登录: admin / admin123456');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUsers();