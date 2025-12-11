const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    // 创建管理员用户
    const adminUser = await prisma.user.create({
      data: {
        id: 'test-admin-001',
        openid: 'admin-openid-001',
        nickname: '测试管理员',
        level: 'DIRECTOR',
        role: 'ADMIN',
        isActive: true,
        phone: '13800000000',
        email: 'admin@test.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✓ 测试管理员创建成功:', adminUser.id);

    // 创建普通用户
    const normalUser = await prisma.user.create({
      data: {
        id: 'test-user-001',
        openid: 'user-openid-001',
        nickname: '测试用户',
        level: 'NORMAL',
        role: 'USER',
        isActive: true,
        phone: '13800000001',
        email: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✓ 测试用户创建成功:', normalUser.id);

    // 创建VIP用户
    const vipUser = await prisma.user.create({
      data: {
        id: 'test-vip-001',
        openid: 'vip-openid-001',
        nickname: '测试VIP用户',
        level: 'VIP',
        role: 'USER',
        isActive: true,
        phone: '13800000002',
        email: 'vip@test.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    console.log('✓ 测试VIP用户创建成功:', vipUser.id);

  } catch (error) {
    console.error('创建用户失败:', error.message);

    // 如果用户已存在，尝试查找
    try {
      const users = await prisma.user.findMany({
        take: 5,
        select: {
          id: true,
          nickname: true,
          level: true,
          role: true,
          isActive: true
        }
      });
      console.log('\n数据库中的用户列表:');
      users.forEach(user => {
        console.log(`- ID: ${user.id}, 昵称: ${user.nickname}, 等级: ${user.level}, 角色: ${user.role}, 激活: ${user.isActive}`);
      });
    } catch (findError) {
      console.error('查找用户失败:', findError.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
