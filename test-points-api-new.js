/**
 * 积分API测试脚本
 * 模拟"用户不存在"错误场景
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.development' });

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function testPointsAPI() {
  console.log('='.repeat(60));
  console.log('积分API测试');
  console.log('='.repeat(60));

  try {
    // 1. 获取所有用户
    console.log('\n1. 获取用户列表');
    console.log('-'.repeat(30));
    const users = await prisma.users.findMany({
      select: {
        id: true,
        phone: true,
        nickname: true,
        level: true,
        pointsBalance: true,
        pointsFrozen: true,
        status: true
      }
    });

    console.log(`找到 ${users.length} 个用户:`);
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.nickname} (${user.phone})`);
      console.log(`   ID: ${user.id}`);
      console.log(`   等级: ${user.level}`);
      console.log(`   积分: ${user.pointsBalance} (冻结: ${user.pointsFrozen})`);
      console.log(`   状态: ${user.status}\n`);
    });

    if (users.length === 0) {
      console.log('没有找到用户，请先运行数据填充');
      return;
    }

    // 选择第一个测试用户
    const testUser = users[0];
    console.log(`使用测试用户: ${testUser.nickname} (ID: ${testUser.id})`);

    // 2. 测试获取用户积分余额
    console.log('\n2. 测试获取用户积分余额');
    console.log('-'.repeat(30));

    try {
      const user = await prisma.users.findUnique({
        where: { id: testUser.id },
        select: {
          id: true,
          phone: true,
          nickname: true,
          level: true,
          pointsBalance: true,
          pointsFrozen: true,
          status: true
        }
      });

      if (user) {
        console.log(`✅ 用户存在: ${user.nickname}`);
        console.log(`   积分余额: ${user.pointsBalance}`);
        console.log(`   冻结积分: ${user.pointsFrozen}`);
        console.log(`   可用积分: ${user.pointsBalance - user.pointsFrozen}`);
      } else {
        console.log(`❌ 用户不存在: ${testUser.id}`);
      }
    } catch (error) {
      console.log(`❌ 查询用户失败: ${error.message}`);
    }

    // 3. 测试获取积分交易记录
    console.log('\n3. 测试获取积分交易记录');
    console.log('-'.repeat(30));

    try {
      const transactions = await prisma.pointsTransactions.findMany({
        where: {
          OR: [
            { fromUserId: testUser.id },
            { toUserId: testUser.id }
          ]
        },
        select: {
          id: true,
          transactionNo: true,
          fromUserId: true,
          toUserId: true,
          amount: true,
          type: true,
          status: true,
          description: true,
          createdAt: true,
          balanceBefore: true,
          balanceAfter: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      console.log(`找到 ${transactions.length} 条交易记录:`);
      transactions.forEach((tx, idx) => {
        console.log(`${idx + 1}. ${tx.transactionNo}`);
        console.log(`   类型: ${tx.type} (${tx.status})`);
        console.log(`   金额: ${tx.amount > 0 ? '+' : ''}${tx.amount}`);
        console.log(`   余额变化: ${tx.balanceBefore} → ${tx.balanceAfter}`);
        console.log(`   时间: ${tx.createdAt}\n`);
      });
    } catch (error) {
      console.log(`❌ 查询交易记录失败: ${error.message}`);
    }

    // 4. 测试不存在的用户ID
    console.log('\n4. 测试不存在的用户ID');
    console.log('-'.repeat(30));

    const nonExistentUserId = 'non_existent_user_id_12345';

    try {
      const user = await prisma.users.findUnique({
        where: { id: nonExistentUserId },
        select: { id: true, nickname: true }
      });

      if (!user) {
        console.log(`✅ 正确识别用户不存在: ${nonExistentUserId}`);
      }
    } catch (error) {
      console.log(`❌ 查询失败: ${error.message}`);
    }

    // 5. 测试关联查询
    console.log('\n5. 测试关联查询（使用正确的Prisma关系名称）');
    console.log('-'.repeat(30));

    try {
      // 使用正确的关系名称
      const transactionsWithUser = await prisma.pointsTransactions.findMany({
        where: {
          toUserId: testUser.id
        },
        include: {
          users_pointsTransactions_toUserIdTousers: {
            select: {
              id: true,
              phone: true,
              nickname: true,
              level: true
            }
          }
        },
        take: 5
      });

      console.log(`关联查询结果（${transactionsWithUser.length} 条）:`);
      transactionsWithUser.forEach((tx, idx) => {
        const user = tx.users_pointsTransactions_toUserIdTousers;
        console.log(`${idx + 1}. 交易号: ${tx.transactionNo}`);
        console.log(`   用户: ${user?.nickname || '未知'} (${user?.phone || 'N/A'})`);
        console.log(`   类型: ${tx.type}, 金额: ${tx.amount}\n`);
      });
    } catch (error) {
      console.log(`❌ 关联查询失败: ${error.message}`);
    }

    // 6. 测试分页查询
    console.log('\n6. 测试分页查询性能');
    console.log('-'.repeat(30));

    const testPageSizes = [10, 20, 50];

    for (const pageSize of testPageSizes) {
      const start = Date.now();
      try {
        const result = await prisma.pointsTransactions.findMany({
          where: { toUserId: testUser.id },
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            type: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: pageSize
        });

        console.log(`✅ 分页查询 (${pageSize}条) 耗时: ${Date.now() - start}ms`);
      } catch (error) {
        console.log(`❌ 分页查询失败: ${error.message}`);
      }
    }

    // 7. 模拟积分转账
    console.log('\n7. 模拟积分转账');
    console.log('-'.repeat(30));

    if (users.length >= 2) {
      const fromUser = users[0];
      const toUser = users[1];
      const amount = 100;

      console.log(`模拟转账: ${fromUser.nickname} → ${toUser.nickname}, 金额: ${amount}`);

      try {
        await prisma.$transaction(async (tx) => {
          // 检查用户
          const [sender, receiver] = await Promise.all([
            tx.users.findUnique({ where: { id: fromUser.id } }),
            tx.users.findUnique({ where: { id: toUser.id } })
          ]);

          if (!sender) throw new Error('发送方用户不存在');
          if (!receiver) throw new Error('接收方用户不存在');

          // 检查余额
          const availableBalance = sender.pointsBalance - sender.pointsFrozen;
          if (availableBalance < amount) {
            throw new Error('余额不足');
          }

          // 更新余额
          await Promise.all([
            tx.users.update({
              where: { id: fromUser.id },
              data: { pointsBalance: { decrement: amount } }
            }),
            tx.users.update({
              where: { id: toUser.id },
              data: { pointsBalance: { increment: amount } }
            })
          ]);

          // 创建交易记录
          const transactionNo = `PT${Date.now()}TEST`;
          await tx.pointsTransactions.create({
            data: {
              id: `ptx${Date.now()}${Math.random().toString(36).substring(2, 8)}`,
              transactionNo,
              fromUserId: fromUser.id,
              toUserId: toUser.id,
              amount,
              type: 'TRANSFER',
              status: 'COMPLETED',
              balanceBefore: sender.pointsBalance,
              balanceAfter: sender.pointsBalance - amount,
              description: '测试转账',
              createdAt: new Date(),
              completedAt: new Date()
            }
          });

          console.log(`✅ 转账成功，交易号: ${transactionNo}`);
        });
      } catch (error) {
        console.log(`❌ 转账失败: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
    console.log('\n测试完成');
  }
}

// 运行测试
testPointsAPI().catch(console.error);