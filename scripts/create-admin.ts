import { prisma } from '../src/shared/database/client';
import bcrypt from 'bcryptjs';
import { AdminRole, AdminStatus } from '@prisma/client';

async function createAdmin() {
  try {
    console.log('开始创建系统管理员...');

    const adminData = {
      username: 'admin',
      password: await bcrypt.hash('admin123456', 10),
      realName: '系统管理员',
      email: 'admin@zhongdao.com',
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
      permissions: JSON.stringify({
        all: true, // 超级管理员拥有所有权限
        modules: ['users', 'products', 'orders', 'inventory', 'teams', 'payments', 'config']
      })
    };

    // 检查是否已存在admin用户
    const existingAdmin = await prisma.admin.findUnique({
      where: { username: 'admin' }
    });

    if (existingAdmin) {
      console.log('管理员账号已存在，正在更新密码...');
      await prisma.admin.update({
        where: { username: 'admin' },
        data: {
          password: adminData.password,
          realName: adminData.realName,
          email: adminData.email,
          role: adminData.role,
          status: adminData.status,
          permissions: adminData.permissions,
          updatedAt: new Date()
        }
      });
      console.log('管理员账号更新成功！');
    } else {
      await prisma.admin.create({
        data: adminData
      });
      console.log('管理员账号创建成功！');
    }

    console.log('\n=== 管理员账号信息 ===');
    console.log('用户名: admin');
    console.log('密码: admin123456');
    console.log('角色: 超级管理员');
    console.log('邮箱: admin@zhongdao.com');
    console.log('=====================\n');

    console.log('请妥善保管管理员账号信息！');
    console.log('登录地址: http://localhost:5174/login');
    console.log('API地址: http://localhost:3000/api/v1/admin/auth/login');

  } catch (error) {
    console.error('创建管理员失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();