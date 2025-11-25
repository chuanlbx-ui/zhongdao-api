const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    console.log('🔍 检查管理员账户...\n');

    // 查找所有管理员
    const admins = await prisma.admin.findMany();
    console.log(`找到 ${admins.length} 个管理员账户:`);

    admins.forEach(admin => {
      console.log(`- 用户名: ${admin.username}`);
      console.log(`- 角色: ${admin.role}`);
      console.log(`- 状态: ${admin.status}`);
      console.log(`- 创建时间: ${admin.createdAt}`);
      console.log('---');
    });

    // 测试密码验证
    if (admins.length > 0) {
      const admin = admins[0];
      console.log(`\n🔐 测试管理员 ${admin.username} 的密码验证:`);

      // 测试密码 "admin123"
      const isValid = await bcrypt.compare('admin123', admin.password);
      console.log(`密码 "admin123" 验证结果: ${isValid ? '✅ 正确' : '❌ 错误'}`);

      if (!isValid) {
        console.log('🔧 重新设置管理员密码...');
        const newPassword = await bcrypt.hash('admin123', 10);
        await prisma.admin.update({
          where: { id: admin.id },
          data: { password: newPassword }
        });
        console.log('✅ 管理员密码已重置为: admin123');
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin();