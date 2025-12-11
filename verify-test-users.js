// 验证测试用户是否存在于数据库
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyTestUsers() {
  console.log('🔍 验证测试用户数据...\n');

  const testUsers = [
    { id: 'ja4x4705a4emvkga2e73e5ne', phone: '13800138888', level: 'DIRECTOR' },
    { id: 'crho9e2hrp50xqkh2xum9rbp', phone: '13800138001', level: 'NORMAL' }
  ];

  for (const testUser of testUsers) {
    console.log(`检查用户: ${testUser.phone} (${testUser.level})`);

    try {
      // 按ID查找
      const userById = await prisma.users.findUnique({
        where: { id: testUser.id },
        select: {
          id: true,
          phone: true,
          level: true,
          status: true,
          nickname: true,
          userNumber: true,
          createdAt: true
        }
      });

      // 按手机号查找
      const userByPhone = await prisma.users.findUnique({
        where: { phone: testUser.phone },
        select: {
          id: true,
          phone: true,
          level: true,
          status: true,
          nickname: true,
          userNumber: true,
          createdAt: true
        }
      });

      if (userById) {
        console.log(`  ✅ 按ID找到用户: ${userById.id}`);
        console.log(`     手机号: ${userById.phone}`);
        console.log(`     等级: ${userById.level}`);
        console.log(`     状态: ${userById.status}`);
        console.log(`     昵称: ${userById.nickname || '未设置'}`);
        console.log(`     用户编号: ${userById.userNumber}`);
        console.log(`     创建时间: ${userById.createdAt}`);
      } else {
        console.log(`  ❌ 按ID未找到用户: ${testUser.id}`);
      }

      if (userByPhone) {
        console.log(`  ✅ 按手机号找到用户: ${userByPhone.id}`);
        if (userByPhone.id !== testUser.id) {
          console.log(`  ⚠️ ID不匹配: 期望 ${testUser.id}, 实际 ${userByPhone.id}`);
        }
      } else {
        console.log(`  ❌ 按手机号未找到用户: ${testUser.phone}`);
      }

    } catch (error) {
      console.log(`  💥 查询出错: ${error.message}`);
    }

    console.log('---');
  }

  // 检查数据库中的所有管理员级别的用户
  console.log('\n👑 检查数据库中的管理员用户:');
  try {
    const adminUsers = await prisma.users.findMany({
      where: { level: 'DIRECTOR' },
      select: {
        id: true,
        phone: true,
        level: true,
        status: true,
        nickname: true,
        userNumber: true,
        createdAt: true
      },
      take: 10
    });

    if (adminUsers.length > 0) {
      console.log(`  找到 ${adminUsers.length} 个管理员用户:`);
      adminUsers.forEach(user => {
        console.log(`    - ${user.phone} (${user.id.substring(0, 8)}...)`);
      });
    } else {
      console.log('  ❌ 数据库中没有管理员用户');
    }
  } catch (error) {
    console.log(`  💥 查询管理员用户出错: ${error.message}`);
  }

  // 检查所有用户数量
  console.log('\n📊 数据库统计:');
  try {
    const totalUsers = await prisma.users.count();
    const activeUsers = await prisma.users.count({ where: { status: 'ACTIVE' } });
    const normalUsers = await prisma.users.count({ where: { level: 'NORMAL' } });
    const directorUsers = await prisma.users.count({ where: { level: 'DIRECTOR' } });

    console.log(`  总用户数: ${totalUsers}`);
    console.log(`  活跃用户: ${activeUsers}`);
    console.log(`  普通用户: ${normalUsers}`);
    console.log(`  管理员用户: ${directorUsers}`);
  } catch (error) {
    console.log(`  💥 统计查询出错: ${error.message}`);
  }

  await prisma.$disconnect();
  console.log('\n✅ 用户验证完成');
}

verifyTestUsers().catch(console.error);