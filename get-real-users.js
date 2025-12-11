// 获取真实的测试用户
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

function generateToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    phone: user.phone,
    role: user.level,
    level: user.level,
    scope: ['active', 'user'],
    type: 'access',
    iat: now,
    exp: now + (24 * 60 * 60),
    aud: 'zhongdao-mall-users',
    iss: 'zhongdao-mall-test'
  };

  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
}

async function getRealUsers() {
  console.log('🔍 获取真实的测试用户...\n');

  try {
    // 获取管理员用户
    const adminUsers = await prisma.users.findMany({
      where: { level: 'DIRECTOR' },
      select: {
        id: true,
        phone: true,
        level: true,
        status: true,
        nickname: true,
        userNumber: true
      },
      take: 2
    });

    // 获取普通用户
    const normalUsers = await prisma.users.findMany({
      where: { level: 'NORMAL' },
      select: {
        id: true,
        phone: true,
        level: true,
        status: true,
        nickname: true,
        userNumber: true
      },
      take: 2
    });

    // 获取VIP用户
    const vipUsers = await prisma.users.findMany({
      where: { level: 'VIP' },
      select: {
        id: true,
        phone: true,
        level: true,
        status: true,
        nickname: true,
        userNumber: true
      },
      take: 1
    });

    const testUsers = [
      ...adminUsers,
      ...vipUsers,
      ...normalUsers
    ];

    console.log('📋 找到的测试用户:');

    const tokens = {};

    testUsers.forEach(user => {
      console.log(`\n${user.level}用户:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  手机号: ${user.phone}`);
      console.log(`  昵称: ${user.nickname || '未设置'}`);
      console.log(`  用户编号: ${user.userNumber}`);
      console.log(`  状态: ${user.status}`);

      const token = generateToken(user);
      tokens[user.level.toLowerCase()] = token;
      console.log(`  Token: ${token.substring(0, 50)}...`);
    });

    // 输出可用于测试的令牌
    console.log('\n🔑 测试令牌:');
    console.log(`// 管理员令牌`);
    console.log(`const ADMIN_TOKEN = '${tokens.director || tokens.vip}';`);
    console.log(`// 普通用户令牌`);
    console.log(`const NORMAL_TOKEN = '${tokens.normal}';`);

    // 保存到文件
    const fs = require('fs');
    fs.writeFileSync('real-test-tokens.js', `
// 真实测试用户的JWT令牌
const ADMIN_TOKEN = '${tokens.director || tokens.vip}';
const NORMAL_TOKEN = '${tokens.normal}';

module.exports = { ADMIN_TOKEN, NORMAL_TOKEN };
console.log('管理员令牌:', ADMIN_TOKEN);
console.log('普通用户令牌:', NORMAL_TOKEN);
`);

    console.log('\n💾 令牌已保存到: real-test-tokens.js');

  } catch (error) {
    console.error('💥 获取用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getRealUsers().catch(console.error);