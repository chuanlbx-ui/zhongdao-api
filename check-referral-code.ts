import { prisma } from './src/shared/database/client';

async function checkReferralCode() {
  try {
    console.log('正在查询推荐码 6GLKU9...');

    const user = await prisma.users.findUnique({
      where: { referralCode: '6GLKU9' },
      select: {
        id: true,
        nickname: true,
        referralCode: true,
        level: true,
        status: true,
        phone: true
      }
    });

    if (user) {
      console.log('找到用户:');
      console.log('ID:', user.id);
      console.log('昵称:', user.nickname);
      console.log('推荐码:', user.referralCode);
      console.log('级别:', user.level);
      console.log('状态:', user.status);
      console.log('手机号:', user.phone);
    } else {
      console.log('未找到推荐码为 6GLKU9 的用户');
    }

    // 查询所有有推荐码的用户
    console.log('\n正在查询所有有推荐码的用户...');
    const allUsers = await prisma.users.findMany({
      where: {
        referralCode: {
          not: null
        }
      },
      select: {
        id: true,
        nickname: true,
        referralCode: true,
        level: true,
        status: true
      },
      take: 20
    });

    console.log(`找到 ${allUsers.length} 个有推荐码的用户:`);
    allUsers.forEach(u => {
      console.log(`- ${u.nickname} (${u.referralCode}) - ${u.level} - ${u.status}`);
    });

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReferralCode();