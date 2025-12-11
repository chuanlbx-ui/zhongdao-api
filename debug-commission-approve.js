const { PrismaClient } = require('@prisma/client');

async function debugCommissionApprove() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('🔍 调试提现批准功能...\n');

    // 1. 查找最近的提现记录
    console.log('1. 查找最近的提现记录:');
    const withdrawals = await prisma.pointsTransactions.findMany({
      where: {
        type: 'WITHDRAW',
        status: 'PENDING'
      },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (withdrawals.length === 0) {
      console.log('❌ 没有找到待处理的提现记录');

      // 查找已完成的佣金记录，转换为提现记录
      console.log('\n2. 查找佣金记录用于测试:');
      const commissions = await prisma.pointsTransactions.findFirst({
        where: {
          type: 'COMMISSION',
          status: 'COMPLETED'
        }
      });

      if (commissions) {
        console.log('✅ 找到佣金记录，创建测试提现记录');
        const testWithdraw = await prisma.pointsTransactions.create({
          data: {
            id: `test_withdraw_${Date.now()}`,
            transactionNo: `TXN${Date.now()}`,
            toUserId: commissions.toUserId, // 使用佣金记录的用户ID
            amount: -100,
            balanceBefore: 1000,
            balanceAfter: 900,
            type: 'WITHDRAW',
            description: '测试提现',
            status: 'PENDING',
            metadata: JSON.stringify({
              withdrawMethod: 'BANK',
              accountInfo: {
                bankName: '测试银行',
                accountNumber: '123456789'
              }
            })
          }
        });
        console.log('✅ 创建测试提现记录成功:', testWithdraw.id);

        // 重新查找提现记录
        const newWithdrawals = await prisma.pointsTransactions.findMany({
          where: {
            type: 'WITHDRAW',
            status: 'PENDING'
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        });

        console.log('\n3. 测试更新提现状态:');
        const testWithdrawal = newWithdrawals[0];

        // 测试更新
        let metadata = {};
        if (testWithdrawal.metadata) {
          try {
            metadata = typeof testWithdrawal.metadata === 'string'
              ? JSON.parse(testWithdrawal.metadata)
              : testWithdrawal.metadata;
          } catch (e) {
            console.log('⚠️  metadata解析失败:', e.message);
          }
        }

        console.log('原metadata:', metadata);

        const updated = await prisma.pointsTransactions.update({
          where: { id: testWithdrawal.id },
          data: {
            status: 'APPROVED',
            completedAt: new Date(),
            metadata: JSON.stringify({
              ...metadata,
              approvedBy: 'test_admin',
              approvedAt: new Date().toISOString(),
              remark: '测试批准',
              transactionId: 'TXN123456789'
            })
          }
        });

        console.log('✅ 更新成功:', updated.status);
      } else {
        console.log('❌ 没有找到佣金记录');
      }
    } else {
      console.log('✅ 找到提现记录:');
      withdrawals.forEach(w => {
        console.log(`  - ID: ${w.id}, 金额: ${w.amount}, 状态: ${w.status}`);
      });
    }

    // 2. 测试更新操作
    console.log('\n3. 测试更新提现状态:');
    const testWithdrawal = withdrawals[0];
    if (testWithdrawal) {
      console.log(`更新提现记录: ${testWithdrawal.id}`);

      // 尝试解析metadata
      let metadata = {};
      if (testWithdrawal.metadata) {
        try {
          metadata = typeof testWithdrawal.metadata === 'string'
            ? JSON.parse(testWithdrawal.metadata)
            : testWithdrawal.metadata;
        } catch (e) {
          console.log('⚠️  metadata解析失败:', e.message);
        }
      }

      console.log('原metadata:', metadata);

      // 执行更新
      const updated = await prisma.pointsTransactions.update({
        where: { id: testWithdrawal.id },
        data: {
          status: 'APPROVED',
          completedAt: new Date(),
          metadata: JSON.stringify({
            ...metadata,
            approvedBy: 'test_admin',
            approvedAt: new Date().toISOString(),
            remark: '测试批准',
            transactionId: 'TXN123456789'
          })
        }
      });

      console.log('✅ 更新成功:', updated.status);
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error('详细错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCommissionApprove();