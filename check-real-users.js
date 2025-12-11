#!/usr/bin/env node

/**
 * 检查数据库中的真实用户
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['info'],
});

async function checkRealUsers() {
  try {
    console.log('检查数据库中的真实用户...\n');

    // 查找真实用户
    const users = await prisma.users.findMany({
      select: {
        id: true,
        phone: true,
        nickname: true,
        level: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`找到 ${users.length} 个用户:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   手机号: ${user.phone}`);
      console.log(`   昵称: ${user.nickname || '未设置'}`);
      console.log(`   级别: ${user.level}`);
      console.log(`   状态: ${user.status}`);
      console.log(`   创建时间: ${user.createdAt}\n`);
    });

    // 检查是否有交易记录
    const transactionsCount = await prisma.pointsTransactions.count();
    console.log(`数据库中的交易记录总数: ${transactionsCount}`);

    if (transactionsCount > 0) {
      // 查找有交易记录的用户
      const firstTransaction = await prisma.pointsTransactions.findFirst({
        select: {
          fromUserId: true,
          toUserId: true
        }
      });

      console.log('\n第一条交易记录的用户ID:');
      if (firstTransaction) {
        console.log(`- fromUserId: ${firstTransaction.fromUserId}`);
        console.log(`- toUserId: ${firstTransaction.toUserId}`);
      }
    }

  } catch (error) {
    console.error('检查用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 主函数
async function main() {
  try {
    await checkRealUsers();
    process.exit(0);
  } catch (error) {
    console.error('失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { checkRealUsers };