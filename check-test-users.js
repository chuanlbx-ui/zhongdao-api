// 检查数据库中的测试用户
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestUsers() {
  console.log('🔍 检查数据库中的测试用户...\n');

  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 查询测试用户
    const testUserIds = [
      'ja4x4705a4emvkga2e73n5e',  // admin token中的sub
      'cmi4ndwmo0000eddyd3o50j4n',  // 普通用户token中的sub
    ];

    const testPhones = [
      '13800138888',  // admin phone
      '13800138001',  // 普通用户phone
    ];

    console.log('📋 按用户ID查询:');
    for (const userId of testUserIds) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          role: true,
          level: true,
          isActive: true,
          nickname: true
        }
      });

      if (user) {
        console.log(`  ✅ 用户 ${userId}:`);
        console.log(`     - 手机: ${user.phone}`);
        console.log(`     - 角色: ${user.role}`);
        console.log(`     - 等级: ${user.level}`);
        console.log(`     - 状态: ${user.isActive ? '活跃' : '未激活'}`);
      } else {
        console.log(`  ❌ 用户 ${userId} 不存在`);
      }
    }

    console.log('\n📋 按手机号查询:');
    for (const phone of testPhones) {
      const user = await prisma.user.findUnique({
        where: { phone },
        select: {
          id: true,
          phone: true,
          role: true,
          level: true,
          isActive: true,
          nickname: true
        }
      });

      if (user) {
        console.log(`  ✅ 手机 ${phone}:`);
        console.log(`     - ID: ${user.id}`);
        console.log(`     - 角色: ${user.role}`);
        console.log(`     - 等级: ${user.level}`);
        console.log(`     - 状态: ${user.isActive ? '活跃' : '未激活'}`);
      } else {
        console.log(`  ❌ 手机 ${phone} 不存在`);
      }
    }

    console.log('\n📋 查询所有管理员用户:');
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        phone: true,
        role: true,
        level: true,
        isActive: true,
        nickname: true
      },
      take: 5
    });

    if (adminUsers.length > 0) {
      adminUsers.forEach(user => {
        console.log(`  - ${user.id}: ${user.phone} (${user.level}) - ${user.isActive ? '活跃' : '未激活'}`);
      });
    } else {
      console.log('  ❌ 没有找到管理员用户');
    }

    console.log('\n📋 查询所有活跃用户（前10个）:');
    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        phone: true,
        role: true,
        level: true,
        nickname: true
      },
      take: 10
    });

    if (activeUsers.length > 0) {
      activeUsers.forEach(user => {
        console.log(`  - ${user.id}: ${user.phone} (${user.role}, ${user.level})`);
      });
    } else {
      console.log('  ❌ 没有找到活跃用户');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestUsers().catch(console.error);