const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 检查数据库用户...\n');

    // 查询所有用户（没有role字段，只有level）
    const allUsers = await prisma.$queryRaw`SELECT id, phone, level, status FROM users LIMIT 10`;
    console.log('前10个用户:', allUsers);

    // 查询特定ID用户
    const testUsers = await prisma.$queryRaw`SELECT id, phone, level, status FROM users WHERE id IN ('ja4x4705a4emvkga2e73n5e', 'cmi4ndwmo0000eddyd3o50j4n')`;
    console.log('\n测试用户:', testUsers);

    // 查询特定手机号用户
    const phoneUsers = await prisma.$queryRaw`SELECT id, phone, level, status FROM users WHERE phone IN ('13800138888', '13800138001')`;
    console.log('\n手机号用户:', phoneUsers);

    // 查询活跃用户
    const activeUsers = await prisma.$queryRaw`SELECT id, phone, level, status FROM users WHERE status = 'ACTIVE' LIMIT 10`;
    console.log('\n前10个活跃用户:', activeUsers);

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();