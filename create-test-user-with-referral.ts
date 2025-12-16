import { prisma } from './src/shared/database/client';
import bcrypt from 'bcryptjs';

async function createTestUser() {
  try {
    // 先创建一个有推荐码的用户（推荐人）
    const referrerPasswordHash = await bcrypt.hash('123456', 10);
    const referrer = await prisma.users.create({
      data: {
        id: "test_referrer_001",
        openid: "test_openid_referrer_001",
        phone: "13900139000",
        nickname: "测试推荐人",
        password: referrerPasswordHash,
        referralCode: "6GLKU9", // 用户提供的推荐码
        level: 'VIP',
        status: 'ACTIVE',
        parentId: null,
        teamLevel: 1,
        teamPath: null,
      }
    });

    console.log('创建推荐人成功:');
    console.log('ID:', referrer.id);
    console.log('昵称:', referrer.nickname);
    console.log('推荐码:', referrer.referralCode);
    console.log('级别:', referrer.level);
    console.log('状态:', referrer.status);

    // 再创建一个普通用户用于测试
    const normalUserPasswordHash = await bcrypt.hash('123456', 10);
    const normalUser = await prisma.users.create({
      data: {
        id: "test_user_001",
        openid: "test_openid_001",
        phone: "13800138001",
        nickname: "测试用户",
        password: normalUserPasswordHash,
        referralCode: "7FHSJM", // 生成另一个推荐码
        level: 'NORMAL',
        status: 'ACTIVE',
        parentId: null,
        teamLevel: 1,
        teamPath: null,
      }
    });

    console.log('\n创建普通用户成功:');
    console.log('ID:', normalUser.id);
    console.log('昵称:', normalUser.nickname);
    console.log('推荐码:', normalUser.referralCode);
    console.log('级别:', normalUser.level);
    console.log('状态:', normalUser.status);

  } catch (error) {
    if (error.code === 'P2002') {
      console.log('用户已存在，正在更新推荐码...');
      // 如果用户已存在，更新推荐码
      const updatedUser = await prisma.users.update({
        where: { phone: "13900139000" },
        data: { referralCode: "6GLKU9" }
      });
      console.log('更新成功:', updatedUser.referralCode);
    } else {
      console.error('错误:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();