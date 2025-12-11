const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findAdminUser() {
  try {
    // 查找董事等级用户
    let admin = await prisma.users.findFirst({
      where: { level: 'DIRECTOR' }
    });

    if (!admin) {
      // 查找任何活跃用户
      admin = await prisma.users.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });

      if (admin) {
        console.log('Found active user (will use for testing):', admin.id);
      } else {
        console.log('No users found in database');
        return;
      }
    } else {
      console.log('Found director user:', admin.id);
    }

    // 生成JWT token
    const jwt = require('jsonwebtoken');
    const payload = {
      sub: admin.id,
      scope: ['active', 'user'],
      role: 'ADMIN',
      level: admin.level,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'zhongdao-mall-secret-key-2024', {
      algorithm: 'HS256',
      issuer: 'zhongdao-mall',
      audience: 'zhongdao-mall-users'
    });

    console.log('\nAdmin JWT Token:');
    console.log(token);
    console.log('\nUser Info:');
    console.log('- ID:', admin.id);
    console.log('- Nickname:', admin.nickname);
    console.log('- Role:', admin.role);
    console.log('- Level:', admin.level);
    console.log('- Balance:', admin.pointsBalance);

    // 使用这个token测试API的curl命令
    console.log('\nTest command:');
    console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/v1/points/balance`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findAdminUser();