import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== 查询ADMIN用户 ===');
    const adminUsers = await prisma.users.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        userNumber: true,
        phone: true,
        nickname: true,
        level: true,
        role: true,
        status: true,
        pointsBalance: true,
        pointsFrozen: true,
        createdAt: true
      }
    });

    console.log(`找到 ${adminUsers.length} 个ADMIN用户:`);
    adminUsers.forEach(user => {
      console.log(`- ID: ${user.id}`);
      console.log(`  用户编号: ${user.userNumber}`);
      console.log(`  手机号: ${user.phone}`);
      console.log(`  昵称: ${user.nickname || '无'}`);
      console.log(`  等级: ${user.level}`);
      console.log(`  角色: ${user.role}`);
      console.log(`  状态: ${user.status}`);
      console.log(`  积分余额: ${user.pointsBalance}`);
      console.log(`  冻结积分: ${user.pointsFrozen}`);
      console.log(`  创建时间: ${user.createdAt}`);
      console.log('---');
    });

    // 查询ADMIN用户的积分交易记录
    if (adminUsers.length > 0) {
      const adminId = adminUsers[0].id;
      console.log(`\n=== 查询用户 ${adminId} 的积分交易记录 ===`);
      const transactions = await prisma.pointsTransactions.findMany({
        where: {
          OR: [
            { fromUserId: adminId },
            { toUserId: adminId }
          ]
        },
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          transactionNo: true,
          amount: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          fromUserId: true,
          toUserId: true
        }
      });

      console.log(`找到 ${transactions.length} 条交易记录:`);
      transactions.forEach(t => {
        const direction = t.toUserId === adminId ? '收入' : '支出';
        console.log(`- ${direction} ${Math.abs(t.amount)} 积分`);
        console.log(`  类型: ${t.type}`);
        console.log(`  描述: ${t.description || '无'}`);
        console.log(`  状态: ${t.status}`);
        console.log(`  时间: ${t.createdAt}`);
        console.log('---');
      });
    }

  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();