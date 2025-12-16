// 创建管理员账号
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev'
    }
  }
});

async function createAdmin() {
  try {
    console.log('连接数据库...');

    // 检查是否已存在admin账号
    const existingAdmin = await prisma.admins.findFirst({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('admin账号已存在');
      console.log('用户名:', existingAdmin.username);
      console.log('角色:', existingAdmin.role);
      console.log('状态:', existingAdmin.status);
      return;
    }

    // 创建admin账号
    const bcrypt = require('bcryptjs');
    const password = 'admin123456';
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admins.create({
      data: {
        id: 'admin_001',
        username: 'admin',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        email: 'admin@zhongdao.com',
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('管理员账号创建成功!');
    console.log('用户名: admin');
    console.log('密码:', password);
    console.log('角色: SUPER_ADMIN');
    console.log('ID:', admin.id);

  } catch (error) {
    console.error('创建失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();