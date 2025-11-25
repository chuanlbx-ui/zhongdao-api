import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'mysql://dev_user:dev_password_123@localhost:3307/zhongdao_mall_dev'
    }
  }
});

async function createAdminUser() {
  try {
    console.log('🔧 创建管理员用户...');

    // 检查是否已存在管理员
    const existingAdmin = await prisma.admin.findFirst();
    if (existingAdmin) {
      console.log('✅ 管理员已存在:', existingAdmin.username);
      return;
    }

    // 创建默认管理员
    const hashedPassword = await bcrypt.hash('admin123456', 12);

    const admin = await prisma.admin.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        realName: '系统管理员',
        email: 'admin@zhongdao.com',
        phone: '13800000000',
        role: AdminRole.SUPER_ADMIN,
        status: AdminStatus.ACTIVE,
        permissions: [
          'users.read', 'users.write', 'users.delete',
          'products.read', 'products.write', 'products.delete',
          'orders.read', 'orders.write', 'orders.delete',
          'shops.read', 'shops.write', 'shops.delete',
          'payments.read', 'payments.write',
          'config.read', 'config.write',
          'dashboard.read',
          'commission.read', 'commission.write',
          'inventory.read', 'inventory.write',
          'teams.read', 'teams.write'
        ],
        loginAttempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log('✅ 管理员创建成功:');
    console.log('   用户名: admin');
    console.log('   密码: admin123456');
    console.log('   角色: ', admin.role);
    console.log('   ID: ', admin.id);

  } catch (error) {
    console.error('❌ 创建管理员失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();